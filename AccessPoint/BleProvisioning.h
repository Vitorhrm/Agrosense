#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLESecurity.h>
#include <Preferences.h>
#include <atomic>
#include <esp_random.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "LoraProvisioning.h"
#include "ReceiverWifi.h"
#include "ProvisioningSettings.h"

// Provisionamento do Access Point, incluindo busca e validação do Wi-Fi.
class BleProvisioning : private BLEServerCallbacks, private BLECharacteristicCallbacks {
 public:
  explicit BleProvisioning(RadioLink& radio, ReceiverWifi& wifi) : lora_(radio), wifi_(wifi) {}
  // Chame antes de iniciar BLE. Uma configuracao BLE substitui o fallback compilado.
  void load(const char* defaultName, const char* wifiSsid = "", const char* wifiPassword = "") {
    strlcpy(settings_.name, defaultName, sizeof(settings_.name));
    strlcpy(settings_.wifi.ssid, wifiSsid, sizeof(settings_.wifi.ssid));
    strlcpy(settings_.wifi.password, wifiPassword, sizeof(settings_.wifi.password));
    storageReady_ = preferences_.begin("agrosense", false);
    ProvisioningSettings stored{};
    if (storageReady_ && readSettings(stored)) {
      memcpy(settings_.name, stored.name, sizeof(settings_.name));
      settings_.name[sizeof(settings_.name) - 1] = '\0';
      if (stored.wifiSaved) {
        settings_.wifi = stored.wifi;
        settings_.wifi.ssid[sizeof(settings_.wifi.ssid) - 1] = '\0';
        settings_.wifi.password[sizeof(settings_.wifi.password) - 1] = '\0';
        settings_.wifiSaved = stored.wifiSaved;
      }
      settings_.lora = stored.lora;
    }
  }

  ProvisionedWifi initialWifi() const { return settings_.wifi; }

  void begin(const char* advertisedName, bool receiver, const char* node, bool radioReady) {
    receiver_ = receiver;
    node_ = node;
    radioReady_ = radioReady;

    commandQueue_ = xQueueCreate(2, sizeof(Command));
    if (!commandQueue_) {
      Serial.println("Configuracao Bluetooth indisponivel: sem memoria para a fila.");
      return;
    }

    const uint64_t mac = ESP.getEfuseMac();
    snprintf(deviceId_, sizeof(deviceId_), "%02x%02x%02x%02x%02x%02x",
             static_cast<unsigned>(mac & 0xff), static_cast<unsigned>((mac >> 8) & 0xff),
             static_cast<unsigned>((mac >> 16) & 0xff), static_cast<unsigned>((mac >> 24) & 0xff),
             static_cast<unsigned>((mac >> 32) & 0xff), static_cast<unsigned>((mac >> 40) & 0xff));

    if (!BLEDevice::init(advertisedName)) {
      Serial.println("Configuracao Bluetooth indisponivel. A telemetria continua ativa.");
      return;
    }
    BLESecurity::setAuthenticationMode(ESP_LE_AUTH_REQ_SC_MITM_BOND);
    BLESecurity::setCapability(ESP_IO_CAP_OUT);
    BLESecurity::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_MITM);
    BLESecurity::setInitEncryptionKey();
    BLESecurity::setRespEncryptionKey();
    const uint32_t pin = 100000 + esp_random() % 900000;
    BLESecurity::setPassKey(true, pin);

    BLEServer* server = BLEDevice::createServer();
    server->setCallbacks(this);
    BLEService* service = server->createService(SERVICE_UUID);
    BLECharacteristic* request = service->createCharacteristic(REQUEST_UUID, BLECharacteristic::PROPERTY_WRITE);
    request->setAccessPermissions(ESP_GATT_PERM_WRITE_ENC_MITM);
    request->setCallbacks(this);
    response_ = service->createCharacteristic(RESPONSE_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    response_->setAccessPermissions(ESP_GATT_PERM_READ_ENC_MITM);
    auto* subscription = new BLE2902();
    subscription->setAccessPermissions(ESP_GATT_PERM_READ_ENC_MITM | ESP_GATT_PERM_WRITE_ENC_MITM);
    response_->addDescriptor(subscription);
    service->start();

    advertising_ = BLEDevice::getAdvertising();
    BLEAdvertisementData advertisement;
    advertisement.setFlags(ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT);
    advertisement.setCompleteServices(BLEUUID(SERVICE_UUID));
    BLEAdvertisementData scanResponse;
    scanResponse.setName(advertisedName);
    advertising_->setAdvertisementData(advertisement);
    advertising_->setScanResponseData(scanResponse);
    advertising_->setScanResponse(true);
    needsSetup_.store(!settings_.lora.enabled());
    openedAt_.store(millis());
    advertising_->start();
    Serial.printf("Configuracao Bluetooth. PIN deste boot: %06lu\n",
                  static_cast<unsigned long>(pin));
  }

  void update() {
    serviceRadio();
    if (!advertising_) return;
    serviceWifi();
    if (configurationFinished()) {
      advertising_->stop();
      advertising_ = nullptr;
      BLEDevice::deinit(false);
      return;
    }
    if (!withinWindow()) {
      if (!closed_.exchange(true)) advertising_->stop();
    } else if (advertiseAgain_.exchange(false)) {
      advertising_->start();
    }
    Command command{};
    if (xQueueReceive(commandQueue_, &command, 0) != pdTRUE || command.session != session_.load()) return;
    responseSession_ = command.session;
    if (command.error) sendError(command.error);
    else if (!withinWindow()) sendError("window_closed");
    else if (wifiOperation_ != WifiOperation::idle || lora_.busy()) sendError("lora_busy");
    else handleFrame(command);
  }

  bool handleRadio(const JsonDocument& packet, int rssi) {
    return lora_.handle(packet, rssi, receiver_, settings_.lora);
  }

  const ProvisionedLora& loraNetwork() const { return settings_.lora; }
  bool loraBusy() const { return lora_.busy(); }
  bool configurationFinished() const {
    return advertising_ == nullptr || !withinWindow() ||
        (configurationSaved_ && session_.load() != savedSession_);
  }

  void setWifiConnected(bool connected) { wifiConnected_.store(connected); }

 private:
  static constexpr const char* SERVICE_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c00";
  static constexpr const char* REQUEST_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c01";
  static constexpr const char* RESPONSE_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c02";
  static constexpr const char* SETTINGS_KEY = "settings-v2";
  static constexpr size_t CHUNK_BYTES = 20;
  static constexpr uint32_t WINDOW_MS = 5 * 60 * 1000;
  static constexpr uint32_t FRAME_TIMEOUT_MS = 5000;

  struct Command {
    uint32_t session = 0;
    size_t size = 0;
    const char* error = nullptr;
    char json[512]{};
  };

  Preferences preferences_;
  ProvisioningSettings settings_{};
  ProvisioningSettings pendingSettings_{};
  LoraProvisioning lora_;
  ReceiverWifi& wifi_;
  enum class WifiOperation { idle, scan, connect };
  WifiOperation wifiOperation_ = WifiOperation::idle;
  uint32_t wifiStartedAt_ = 0;
  uint32_t wifiSession_ = 0;
  BLECharacteristic* response_ = nullptr;
  BLEAdvertising* advertising_ = nullptr;
  QueueHandle_t commandQueue_ = nullptr;
  std::atomic<uint32_t> session_{0};
  uint32_t responseSession_ = 0;
  uint32_t radioSession_ = 0;
  std::atomic<bool> advertiseAgain_{false};
  std::atomic<bool> wifiConnected_{false};
  std::atomic<bool> closed_{false};
  bool configurationSaved_ = false;
  uint32_t savedSession_ = 0;
  std::atomic<bool> needsSetup_{true};
  bool storageReady_ = false;
  bool receiver_ = false;
  bool radioReady_ = false;
  const char* node_ = "";
  char deviceId_[13]{};
  std::atomic<uint32_t> openedAt_{0};
  uint32_t lastChunkAt_ = 0;
  char frame_[512]{};
  size_t frameSize_ = 0;
  bool discardFrame_ = false;

  bool readSettings(ProvisioningSettings& stored) {
    if (preferences_.getBytesLength(SETTINGS_KEY) == sizeof(stored) &&
        preferences_.getBytes(SETTINGS_KEY, &stored, sizeof(stored)) == sizeof(stored)) return true;
    LegacyProvisioningSettings legacy{};
    if (preferences_.getBytesLength("settings-v1") != sizeof(legacy) ||
        preferences_.getBytes("settings-v1", &legacy, sizeof(legacy)) != sizeof(legacy)) return false;
    static_cast<LegacyProvisioningSettings&>(stored) = legacy;
    return true;
  }

  bool withinWindow() const {
    if (closed_.load()) return false;
    return needsSetup_.load() || static_cast<uint32_t>(millis() - openedAt_.load()) < WINDOW_MS;
  }

  void clearFrame() {
    memset(frame_, 0, frameSize_);
    frameSize_ = 0;
    discardFrame_ = false;
  }

  void onDisconnect(BLEServer*) override {
    clearFrame();
    session_.fetch_add(1);
    advertiseAgain_.store(true);
  }

  void enqueueCommand(const char* error = nullptr) {
    Command command{};
    command.session = session_.load();
    command.error = error;
    if (!error) {
      command.size = frameSize_;
      memcpy(command.json, frame_, frameSize_);
    }
    xQueueSend(commandQueue_, &command, 0);
  }

  void onWrite(BLECharacteristic* characteristic) override {
    const String chunk = characteristic->getValue();
    characteristic->setValue("");
    if (!withinWindow()) {
      clearFrame();
      return enqueueCommand("window_closed");
    }
    const uint32_t now = millis();
    if (static_cast<uint32_t>(now - lastChunkAt_) >= FRAME_TIMEOUT_MS) clearFrame();
    lastChunkAt_ = now;

    if (chunk.length() > CHUNK_BYTES) {
      clearFrame();
      return enqueueCommand("invalid_chunk");
    }
    for (size_t index = 0; index < chunk.length(); ++index) {
      const char byte = chunk[index];
      if (byte == '\n') {
        if (discardFrame_ || frameSize_ == 0 || index + 1 != chunk.length()) {
          enqueueCommand("invalid_frame");
        } else {
          enqueueCommand();
        }
        clearFrame();
        return;
      }
      if (byte == '\0' || frameSize_ == sizeof(frame_) - 1) discardFrame_ = true;
      if (!discardFrame_) frame_[frameSize_++] = byte;
    }
  }

  template <size_t size>
  static bool copyField(JsonVariantConst field, char (&output)[size], bool allowEmpty = false) {
    const JsonString text = field.as<JsonString>();
    if ((!allowEmpty && text.size() == 0) || text.size() >= size ||
        !validProvisioningText(text.c_str(), text.size())) return false;
    memset(output, 0, size);
    memcpy(output, text.c_str(), text.size());
    return true;
  }

  static bool emptyOrMissing(JsonVariantConst field) {
    const JsonString text = field.as<JsonString>();
    return field.isUnbound() || (text.c_str() && text.size() == 0);
  }

  void serviceRadio() {
    if (lora_.busy() && (session_.load() != radioSession_ || !withinWindow())) {
      lora_.cancel();
      pendingSettings_ = {};
    }
    const auto result = lora_.update();
    if (result == LoraProvisioning::Result::waiting) return;
    responseSession_ = radioSession_;
    if (result == LoraProvisioning::Result::scanned) {
      JsonDocument reply;
      reply["ok"] = true;
      reply["op"] = "scan_lora";
      lora_.addOffers(reply["networks"].to<JsonArray>());
      return sendReply(reply);
    }
    if (result == LoraProvisioning::Result::paired) {
      commitSettings(pendingSettings_);
    } else {
      sendError("lora_pair_timeout");
    }
    pendingSettings_ = {};
  }

  void handleFrame(const Command& frame) {
    JsonDocument command;
    if (deserializeJson(command, frame.json, frame.size,
                        DeserializationOption::NestingLimit(2)) || !command.is<JsonObject>()) {
      return sendError("invalid_json");
    }
    const JsonVariantConst operation = command["op"];
    if (operation == "info") return sendInfo("info");
    if (operation == "scan_wifi") {
      WiFi.persistent(false);
      WiFi.mode(WIFI_STA);
      if (WiFi.scanNetworks(true) == WIFI_SCAN_FAILED) return sendError("wifi_scan_failed");
      startWifiOperation(WifiOperation::scan);
      return;
    }
    if (operation == "scan_lora") {
      if (receiver_) return sendError("lora_scan_transmitter_only");
      if (!radioReady_) return sendError("lora_unavailable");
      radioSession_ = responseSession_;
      if (!lora_.scan()) sendError("lora_send_failed");
      return;
    }
    if (operation != "save") return sendError("invalid_op");
    configurationSaved_ = false;
    ProvisioningSettings candidate = settings_;
    if (!copyField(command["name"], candidate.name)) return sendError("invalid_name");
    const char* error = applyWifiFields(command, candidate);
    if (error) return sendError(error);
    const char* loraError = applyLoraFields(command, candidate);
    if (loraError) return sendError(loraError);
    if (!receiver_ && memcmp(&settings_.lora, &candidate.lora, sizeof(candidate.lora)) != 0) {
      radioSession_ = responseSession_;
      if (!lora_.pair(candidate.lora)) return sendError("lora_send_failed");
      pendingSettings_ = candidate;
      return;
    }
    if (!candidate.lora.enabled()) return sendError("lora_ssid_required");
    if (!candidate.wifi.ssid[0]) return sendError("wifi_ssid_required");
    if (!wifi_.isConnected() || memcmp(&settings_.wifi, &candidate.wifi, sizeof(candidate.wifi)) != 0) {
      pendingSettings_ = candidate;
      wifi_.begin(candidate.wifi);
      startWifiOperation(WifiOperation::connect);
      return;
    }
    commitSettings(candidate);
  }

  void startWifiOperation(WifiOperation operation) {
    openedAt_.store(millis());
    wifiOperation_ = operation;
    wifiSession_ = responseSession_;
    wifiStartedAt_ = millis();
  }

  void serviceWifi() {
    if (wifiOperation_ == WifiOperation::idle) return;
    const bool cancelled = wifiSession_ != session_.load() || !withinWindow();
    const bool expired = static_cast<uint32_t>(millis() - wifiStartedAt_) >= 18000;
    responseSession_ = wifiSession_;
    if (wifiOperation_ == WifiOperation::scan) {
      const int count = WiFi.scanComplete();
      if (!cancelled && !expired && count == WIFI_SCAN_RUNNING) return;
      wifiOperation_ = WifiOperation::idle;
      if (!cancelled && !expired && count >= 0) {
        JsonDocument reply;
        reply["ok"] = true;
        reply["op"] = "scan_wifi";
        JsonArray networks = reply["networks"].to<JsonArray>();
        for (int index = 0; index < count && networks.size() < 4; ++index) {
          const String ssid = WiFi.SSID(index);
          if (ssid.isEmpty() || ssid.length() > 32 ||
              !validProvisioningText(ssid.c_str(), ssid.length())) continue;
          bool duplicate = false;
          for (JsonObject network : networks) {
            if (network["ssid"] == ssid) { duplicate = true; break; }
          }
          if (duplicate) continue;
          JsonObject network = networks.add<JsonObject>();
          network["ssid"] = ssid;
          network["rssi"] = WiFi.RSSI(index);
          network["open"] = WiFi.encryptionType(index) == WIFI_AUTH_OPEN;
        }
        sendReply(reply);
      } else if (!cancelled) sendError("wifi_scan_failed");
      WiFi.scanDelete();
      return;
    }
    const bool connected = wifi_.isConnected() && WiFi.SSID() == pendingSettings_.wifi.ssid &&
        WiFi.localIP() != IPAddress(0, 0, 0, 0);
    if (!cancelled && !expired && !connected) return;
    wifiOperation_ = WifiOperation::idle;
    if (!cancelled && !expired && connected) {
      wifiConnected_.store(true);
      commitSettings(pendingSettings_);
      if (!configurationSaved_) wifi_.begin(settings_.wifi);
    } else {
      wifi_.begin(settings_.wifi);
      if (!cancelled) sendError("wifi_connection_failed");
    }
    pendingSettings_ = {};
  }

  void commitSettings(const ProvisioningSettings& candidate) {
    if (session_.load() != responseSession_ || !withinWindow()) return;
    ProvisioningSettings stored = candidate;
    if (!stored.wifiSaved) stored.wifi = {};
    if (!storageReady_ || preferences_.putBytes(SETTINGS_KEY, &stored, sizeof(stored)) != sizeof(stored)) {
      return sendError("storage_failed");
    }
    if (memcmp(&settings_.lora, &candidate.lora, sizeof(candidate.lora)) != 0) lora_.clearOutgoing();
    settings_ = candidate;
    sendInfo("save");
    configurationSaved_ = true;
    savedSession_ = responseSession_;
    openedAt_.store(millis());
    needsSetup_.store(false);
  }

  const char* applyLoraFields(const JsonDocument& command, ProvisioningSettings& candidate) {
    const JsonVariantConst ssid = command["lora_ssid"];
    const JsonVariantConst password = command["lora_password"];
    const JsonVariantConst receiverId = command["lora_receiver_id"];
    if (ssid.isUnbound()) {
      return password.isUnbound() && receiverId.isUnbound() ? nullptr : "lora_ssid_required";
    }
    if (!radioReady_) return "lora_unavailable";
    if (!copyField(ssid, candidate.lora.ssid)) return "invalid_lora_ssid";
    if (receiver_) {
      strlcpy(candidate.lora.receiverId, deviceId_, sizeof(candidate.lora.receiverId));
    } else if (!receiverId.isUnbound()) {
      if (!LoraAuth::hex(receiverId.as<JsonString>(), 12) ||
          !copyField(receiverId, candidate.lora.receiverId)) return "invalid_lora_receiver_id";
    } else if (strcmp(candidate.lora.ssid, settings_.lora.ssid) != 0 || !settings_.lora.enabled()) {
      return "invalid_lora_receiver_id";
    }
    if (password.isUnbound()) {
      if (!settings_.lora.enabled() || strcmp(candidate.lora.ssid, settings_.lora.ssid) != 0 ||
          strcmp(candidate.lora.receiverId, settings_.lora.receiverId) != 0) return "lora_password_required";
    } else if (!copyField(password, candidate.lora.password) || strlen(candidate.lora.password) < 16) {
      return "invalid_lora_password";
    }
    return nullptr;
  }

  const char* applyWifiFields(const JsonDocument& command, ProvisioningSettings& candidate) {
    const JsonVariantConst ssid = command["wifi_ssid"];
    const JsonVariantConst password = command["wifi_password"];
    if (!receiver_) {
      return emptyOrMissing(ssid) && emptyOrMissing(password) ? nullptr : "wifi_receiver_only";
    }
    if (ssid.isUnbound()) return password.isUnbound() ? nullptr : "wifi_ssid_required";

    if (!copyField(ssid, candidate.wifi.ssid)) return "invalid_wifi_ssid";
    if (password.isUnbound()) {
      if (strcmp(candidate.wifi.ssid, settings_.wifi.ssid) != 0) return "wifi_password_required";
    } else if (!copyField(password, candidate.wifi.password, true) ||
               !validWifiPassword(candidate.wifi.password, strlen(candidate.wifi.password))) {
      return "invalid_wifi_password";
    }
    candidate.wifiSaved = true;
    return nullptr;
  }

  void sendInfo(const char* operation) {
    JsonDocument reply;
    reply["ok"] = true;
    reply["op"] = operation;
    reply["role"] = receiver_ ? "receiver" : "transmitter";
    reply["device_id"] = deviceId_;
    reply["name"] = settings_.name;
    reply["node"] = node_;
    reply["lora_ssid"] = settings_.lora.ssid;
    reply["lora_receiver_id"] = settings_.lora.receiverId;
    reply["lora_supported"] = radioReady_;
    reply["wifi_ssid"] = settings_.wifi.ssid;
    reply["wifi_saved"] = settings_.wifiSaved;
    reply["wifi_connected"] = wifiConnected_.load();
    sendReply(reply);
  }

  void sendError(const char* error) {
    JsonDocument reply;
    reply["ok"] = false;
    reply["error"] = error;
    sendReply(reply);
  }

  void sendReply(const JsonDocument& reply) {
    if (session_.load() != responseSession_) return;
    uint8_t serialized[512]{};
    const size_t size = measureJson(reply);
    if (reply.overflowed() || size >= sizeof(serialized)) return;
    serializeJson(reply, serialized, sizeof(serialized));
    serialized[size] = '\n';
    for (size_t offset = 0; offset <= size; offset += CHUNK_BYTES) {
      const size_t left = size + 1 - offset;
      response_->setValue(serialized + offset, left > CHUNK_BYTES ? CHUNK_BYTES : left);
      response_->notify();
    }
    response_->setValue(serialized, size + 1);
  }
};

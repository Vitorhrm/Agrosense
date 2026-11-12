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
#include "ProvisioningSettings.h"

// Mantenha as copias em Transmissor e Receptor iguais para abrir cada sketch separadamente.
class BleProvisioning : private BLEServerCallbacks, private BLECharacteristicCallbacks {
 public:
  // Chame antes de iniciar BLE. Uma configuracao BLE substitui o fallback compilado.
  void load(const char* defaultName, const char* wifiSsid = "", const char* wifiPassword = "") {
    strlcpy(settings_.name, defaultName, sizeof(settings_.name));
    strlcpy(settings_.wifi.ssid, wifiSsid, sizeof(settings_.wifi.ssid));
    strlcpy(settings_.wifi.password, wifiPassword, sizeof(settings_.wifi.password));
    storageReady_ = preferences_.begin("agrosense", false);
    ProvisioningSettings stored{};
    if (storageReady_ && preferences_.getBytesLength(SETTINGS_KEY) == sizeof(stored) &&
        preferences_.getBytes(SETTINGS_KEY, &stored, sizeof(stored)) == sizeof(stored)) {
      memcpy(settings_.name, stored.name, sizeof(settings_.name));
      settings_.name[sizeof(settings_.name) - 1] = '\0';
      if (stored.wifiSaved) {
        settings_.wifi = stored.wifi;
        settings_.wifi.ssid[sizeof(settings_.wifi.ssid) - 1] = '\0';
        settings_.wifi.password[sizeof(settings_.wifi.password) - 1] = '\0';
        settings_.wifiSaved = stored.wifiSaved;
      }
    }
  }

  ProvisionedWifi initialWifi() const { return settings_.wifi; }

  void begin(const char* advertisedName, bool receiver, const char* node) {
    receiver_ = receiver;
    node_ = node;
    if (receiver_) wifiQueue_ = xQueueCreate(1, sizeof(ProvisionedWifi));

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
    openedAt_ = millis();
    advertising_->start();
    Serial.printf("Configuracao Bluetooth por 5 min. PIN deste boot: %06lu\n",
                  static_cast<unsigned long>(pin));
  }

  void update() {
    if (!advertising_) return;
    if (!withinWindow()) {
      if (!closed_.exchange(true)) advertising_->stop();
    } else if (advertiseAgain_.exchange(false)) {
      advertising_->start();
    }
  }

  bool takeWifiChange(ProvisionedWifi& wifi) {
    return wifiQueue_ && xQueueReceive(wifiQueue_, &wifi, 0) == pdTRUE;
  }

  void setWifiConnected(bool connected) { wifiConnected_.store(connected); }

 private:
  static constexpr const char* SERVICE_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c00";
  static constexpr const char* REQUEST_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c01";
  static constexpr const char* RESPONSE_UUID = "9ee936a0-982f-4dd6-9353-7152519a3c02";
  static constexpr const char* SETTINGS_KEY = "settings-v1";
  static constexpr size_t CHUNK_BYTES = 20;
  static constexpr uint32_t WINDOW_MS = 5 * 60 * 1000;
  static constexpr uint32_t FRAME_TIMEOUT_MS = 5000;

  Preferences preferences_;
  ProvisioningSettings settings_{};
  BLECharacteristic* response_ = nullptr;
  BLEAdvertising* advertising_ = nullptr;
  QueueHandle_t wifiQueue_ = nullptr;
  std::atomic<bool> advertiseAgain_{false};
  std::atomic<bool> wifiConnected_{false};
  std::atomic<bool> closed_{false};
  bool storageReady_ = false;
  bool receiver_ = false;
  const char* node_ = "";
  char deviceId_[13]{};
  uint32_t openedAt_ = 0;
  uint32_t lastChunkAt_ = 0;
  char frame_[512]{};
  size_t frameSize_ = 0;
  bool discardFrame_ = false;

  bool withinWindow() const {
    return !closed_.load() && static_cast<uint32_t>(millis() - openedAt_) < WINDOW_MS;
  }

  void clearFrame() {
    memset(frame_, 0, frameSize_);
    frameSize_ = 0;
    discardFrame_ = false;
  }

  void onDisconnect(BLEServer*) override {
    clearFrame();
    response_->setValue("");
    advertiseAgain_.store(true);
  }

  void onWrite(BLECharacteristic* characteristic) override {
    const String chunk = characteristic->getValue();
    characteristic->setValue("");
    if (!withinWindow()) {
      clearFrame();
      return sendError("window_closed");
    }
    const uint32_t now = millis();
    if (static_cast<uint32_t>(now - lastChunkAt_) >= FRAME_TIMEOUT_MS) clearFrame();
    lastChunkAt_ = now;

    if (chunk.length() > CHUNK_BYTES) {
      clearFrame();
      return sendError("invalid_chunk");
    }
    for (size_t index = 0; index < chunk.length(); ++index) {
      const char byte = chunk[index];
      if (byte == '\n') {
        if (discardFrame_ || frameSize_ == 0 || index + 1 != chunk.length()) {
          sendError("invalid_frame");
        } else {
          handleFrame();
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

  void handleFrame() {
    JsonDocument command;
    if (deserializeJson(command, static_cast<const char*>(frame_), frameSize_,
                        DeserializationOption::NestingLimit(2)) || !command.is<JsonObject>()) {
      return sendError("invalid_json");
    }
    const JsonVariantConst operation = command["op"];
    if (operation == "info") return sendInfo("info");
    if (operation != "save") return sendError("invalid_op");
    if (!emptyOrMissing(command["lora_ssid"]) || !emptyOrMissing(command["lora_password"])) {
      return sendError("lora_unsupported");
    }
    ProvisioningSettings candidate = settings_;
    if (!copyField(command["name"], candidate.name)) return sendError("invalid_name");
    const char* error = applyWifiFields(command, candidate);
    if (error) return sendError(error);
    ProvisioningSettings stored = candidate;
    if (!stored.wifiSaved) stored.wifi = {};
    if (!storageReady_ || preferences_.putBytes(SETTINGS_KEY, &stored, sizeof(stored)) != sizeof(stored)) {
      return sendError("storage_failed");
    }
    const bool wifiChanged = memcmp(&settings_.wifi, &candidate.wifi, sizeof(candidate.wifi)) != 0;
    settings_ = candidate;
    if (wifiChanged) {
      wifiConnected_.store(false);
      xQueueOverwrite(wifiQueue_, &settings_.wifi);
    }
    sendInfo("save", wifiChanged);
  }

  const char* applyWifiFields(const JsonDocument& command, ProvisioningSettings& candidate) {
    const JsonVariantConst ssid = command["wifi_ssid"];
    const JsonVariantConst password = command["wifi_password"];
    if (!receiver_) {
      return emptyOrMissing(ssid) && emptyOrMissing(password) ? nullptr : "wifi_receiver_only";
    }
    if (ssid.isUnbound()) return password.isUnbound() ? nullptr : "wifi_ssid_required";
    if (!wifiQueue_) return "wifi_unavailable";
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

  void sendInfo(const char* operation, bool wifiChangePending = false) {
    JsonDocument reply;
    reply["ok"] = true;
    reply["op"] = operation;
    reply["role"] = receiver_ ? "receiver" : "transmitter";
    reply["device_id"] = deviceId_;
    reply["name"] = settings_.name;
    reply["node"] = node_;
    reply["lora_ssid"] = "";
    reply["lora_supported"] = false;
    reply["wifi_ssid"] = settings_.wifi.ssid;
    reply["wifi_saved"] = settings_.wifiSaved;
    reply["wifi_connected"] = !wifiChangePending && wifiConnected_.load();
    sendReply(reply);
  }

  void sendError(const char* error) {
    JsonDocument reply;
    reply["ok"] = false;
    reply["error"] = error;
    sendReply(reply);
  }

  void sendReply(const JsonDocument& reply) {
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

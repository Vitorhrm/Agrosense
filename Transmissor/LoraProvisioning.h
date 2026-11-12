#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_random.h>
#include <math.h>
#include <mbedtls/md.h>
#include "ProvisioningSettings.h"
#include "RadioLink.h"
#include "StationId.h"

namespace LoraAuth {
inline bool hex(JsonString value, size_t length) {
  if (!value.c_str() || value.size() != length) return false;
  for (size_t i = 0; i < length; ++i) {
    const char byte = value.c_str()[i];
    if (!((byte >= '0' && byte <= '9') || (byte >= 'a' && byte <= 'f'))) return false;
  }
  return true;
}

inline void encode(const uint8_t* bytes, size_t length, char* output) {
  constexpr char HEX[] = "0123456789abcdef";
  for (size_t i = 0; i < length; ++i) {
    output[2 * i] = HEX[bytes[i] >> 4];
    output[2 * i + 1] = HEX[bytes[i] & 0xf];
  }
  output[2 * length] = '\0';
}

inline bool sign(const char* password, const char* data, char (&tag)[25]) {
  uint8_t digest[32];
  const auto* algorithm = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!algorithm || mbedtls_md_hmac(algorithm, reinterpret_cast<const uint8_t*>(password),
      strlen(password), reinterpret_cast<const uint8_t*>(data), strlen(data), digest) != 0) return false;
  encode(digest, 12, tag);
  return true;
}

inline bool matches(JsonString tag, const char (&expected)[25]) {
  if (!hex(tag, 24)) return false;
  unsigned difference = 0;
  for (size_t i = 0; i < 24; ++i) difference |= tag.c_str()[i] ^ expected[i];
  return difference == 0;
}

inline bool proof(const char* domain, const ProvisionedLora& network, const char* nonce,
                  char (&tag)[25]) {
  char data[128];
  const int length = snprintf(data, sizeof(data), "%s|%s|%s|%s", domain, network.receiverId,
                              nonce, network.ssid);
  return length > 0 && static_cast<size_t>(length) < sizeof(data) && sign(network.password, data, tag);
}

// Os campos ambientais assinados viajam como inteiros escalados para evitar divergencia de ponto flutuante.
inline bool readingTag(const JsonDocument& wire, const ProvisionedLora& network, char (&tag)[25]) {
  const JsonString node = wire["node"].as<JsonString>();
  const JsonString boot = wire["b"].as<JsonString>();
  if (!isValidStationId(node.c_str(), node.size()) || !hex(boot, 16) ||
      !wire["seq"].is<uint32_t>() || !wire["uptime_ms"].is<uint32_t>() ||
      !wire["s"].is<int>() || !wire["e"].is<bool>()) return false;

  long values[4];
  const char* keys[] = {"t", "a", "p", "i"};
  for (size_t index = 0; index < 4; ++index) {
    const JsonVariantConst field = wire[keys[index]];
    if (field.isUnbound() || (!field.isNull() && !field.is<int32_t>())) return false;
    values[index] = field.isNull() ? -2147483648L : field.as<int32_t>();
    if (!field.isNull() && values[index] == -2147483648L) return false;
  }
  char data[240];
  const int length = snprintf(data, sizeof(data), "telemetry-v2|%s|%s|%s|%lu|%lu|%ld|%ld|%ld|%d|%d|%ld|%s",
      network.receiverId, boot.c_str(), node.c_str(), static_cast<unsigned long>(wire["seq"].as<uint32_t>()),
      static_cast<unsigned long>(wire["uptime_ms"].as<uint32_t>()), values[0], values[1], values[2],
      wire["s"].as<int>(), wire["e"].as<bool>() ? 1 : 0, values[3], network.ssid);
  return length > 0 && static_cast<size_t>(length) < sizeof(data) && sign(network.password, data, tag);
}

inline void scale(JsonDocument& wire, const char* key, JsonVariantConst field, float factor) {
  if (field.isNull()) wire[key] = nullptr;
  else wire[key] = static_cast<int32_t>(lroundf(field.as<float>() * factor));
}

inline void unscale(JsonDocument& message, const char* key, JsonVariantConst field, float factor) {
  if (field.isNull()) message[key] = nullptr;
  else message[key] = field.as<int32_t>() / factor;
}

inline bool encodeReading(const JsonDocument& message, const ProvisionedLora& network,
                          const char* boot, JsonDocument& wire) {
  wire["v"] = 2;
  wire["b"] = boot;
  for (const char* key : {"node", "seq", "uptime_ms"}) wire[key] = message[key];
  wire["s"] = message["soil_raw"];
  wire["e"] = message["soil_enabled"];
  scale(wire, "t", message["temp_c"], 100);
  scale(wire, "a", message["air_rh_pct"], 100);
  scale(wire, "p", message["pressure_hpa"], 100);
  scale(wire, "i", message["soil_index_pct"], 10);
  char tag[25];
  if (wire.overflowed() || !readingTag(wire, network, tag)) return false;
  wire["h"] = String(tag);
  return !wire.overflowed();
}

inline bool decodeReading(const JsonDocument& wire, const ProvisionedLora& network, JsonDocument& message,
                          char (&eventId)[37]) {
  char tag[25];
  if (wire["v"] != 2 || !readingTag(wire, network, tag) ||
      !matches(wire["h"].as<JsonString>(), tag)) return false;
  message["v"] = 1;
  for (const char* key : {"node", "seq", "uptime_ms"}) message[key] = wire[key];
  message["soil_raw"] = wire["s"];
  message["soil_enabled"] = wire["e"];
  unscale(message, "temp_c", wire["t"], 100);
  unscale(message, "air_rh_pct", wire["a"], 100);
  unscale(message, "pressure_hpa", wire["p"], 100);
  if (!wire["i"].isNull()) unscale(message, "soil_index_pct", wire["i"], 10);
  // A API deduplica reenvios RF autenticados pelo mesmo UUID, inclusive apos reinicio do receptor.
  snprintf(eventId, sizeof(eventId), "%.8s-%.4s-%.4s-%.4s-%.4s%.8s",
      tag, tag + 8, tag + 12, tag + 16, tag + 20, wire["b"].as<const char*>());
  return !message.overflowed();
}
}

class LoraProvisioning {
 public:
  enum class Result { waiting, scanned, paired, timeout };
  explicit LoraProvisioning(RadioLink& radio) : radio_(radio) {}

  bool busy() const { return operation_ != Operation::idle; }

  bool scan() {
    offerCount_ = 0;
    return start(Operation::scan);
  }

  bool pair(const ProvisionedLora& network) {
    target_ = network;
    if (start(Operation::pair)) return true;
    target_ = {};
    return false;
  }

  void cancel() {
    operation_ = Operation::idle;
    target_ = {};
  }

  void clearOutgoing() { outgoing_.clear(); }

  Result update() {
    const uint32_t now = millis();
    if (!outgoing_.isNull() && static_cast<uint32_t>(now - replyScheduledAt_) >= replyDelay_) {
      radio_.send(outgoing_);
      outgoing_.clear();
    }
    if (!busy()) return Result::waiting;
    if (paired_) {
      cancel();
      return Result::paired;
    }
    const uint32_t elapsed = now - startedAt_;
    if (elapsed >= 4000) {
      const Result result = operation_ == Operation::scan ? Result::scanned : Result::timeout;
      cancel();
      return result;
    }
    if (!retried_ && elapsed >= 1900) {
      retried_ = true;
      sendRequest();
    }
    return Result::waiting;
  }

  bool handle(const JsonDocument& packet, int rssi, bool receiver, const ProvisionedLora& network) {
    const JsonVariantConst operation = packet["l"];
    if (operation.isUnbound()) return false;
    const JsonString nonce = packet["n"].as<JsonString>();
    if (!LoraAuth::hex(nonce, 24)) return true;
    if (receiver && network.enabled()) handleRequest(packet, operation, nonce.c_str(), network);
    if (!receiver && busy() && strcmp(nonce.c_str(), nonce_) == 0) {
      if (operation_ == Operation::scan && operation == "offer") remember(packet, rssi);
      if (operation_ == Operation::pair && operation == "paired") {
        char tag[25];
        const JsonString id = packet["id"].as<JsonString>();
        if (LoraAuth::hex(id, 12) && strcmp(id.c_str(), target_.receiverId) == 0 &&
            LoraAuth::proof("pair-rx-v1", target_, nonce_, tag) &&
            LoraAuth::matches(packet["h"].as<JsonString>(), tag)) paired_ = true;
      }
    }
    return true;
  }

  void addOffers(JsonArray output) const {
    for (size_t index = 0; index < offerCount_; ++index) {
      JsonObject offer = output.add<JsonObject>();
      offer["ssid"] = offers_[index].ssid;
      offer["receiver_id"] = offers_[index].id;
      offer["rssi"] = offers_[index].rssi;
    }
  }

 private:
  enum class Operation { idle, scan, pair };
  struct Offer { char ssid[33]; char id[13]; int rssi; };
  RadioLink& radio_;
  Operation operation_ = Operation::idle;
  ProvisionedLora target_{};
  char nonce_[25]{};
  uint32_t startedAt_ = 0;
  bool retried_ = false;
  bool paired_ = false;
  Offer offers_[4]{};
  size_t offerCount_ = 0;
  JsonDocument outgoing_;
  uint32_t replyScheduledAt_ = 0;
  uint32_t replyDelay_ = 0;

  bool start(Operation operation) {
    uint8_t random[12];
    esp_fill_random(random, sizeof(random));
    LoraAuth::encode(random, sizeof(random), nonce_);
    operation_ = operation;
    startedAt_ = millis();
    retried_ = false;
    paired_ = false;
    if (sendRequest()) return true;
    cancel();
    return false;
  }

  bool sendRequest() {
    JsonDocument request;
    request["l"] = operation_ == Operation::scan ? "scan" : "pair";
    request["n"] = nonce_;
    if (operation_ == Operation::pair) {
      char tag[25];
      if (!LoraAuth::proof("pair-tx-v1", target_, nonce_, tag)) return false;
      request["id"] = target_.receiverId;
      request["h"] = String(tag);
    }
    return radio_.send(request);
  }

  void handleRequest(const JsonDocument& packet, JsonVariantConst operation, const char* nonce,
                     const ProvisionedLora& network) {
    if (operation == "scan") {
      if (!outgoing_.isNull()) return;
      outgoing_["l"] = "offer";
      outgoing_["ssid"] = String(network.ssid);
      replyDelay_ = 200 + esp_random() % 500;
    } else if (operation == "pair") {
      const JsonString id = packet["id"].as<JsonString>();
      char tag[25];
      if (!LoraAuth::hex(id, 12) || strcmp(id.c_str(), network.receiverId) != 0 ||
          !LoraAuth::proof("pair-tx-v1", network, nonce, tag) ||
          !LoraAuth::matches(packet["h"].as<JsonString>(), tag) ||
          !LoraAuth::proof("pair-rx-v1", network, nonce, tag)) return;
      outgoing_.clear();
      outgoing_["l"] = "paired";
      outgoing_["h"] = String(tag);
      replyDelay_ = 200;
    } else {
      return;
    }
    outgoing_["id"] = String(network.receiverId);
    outgoing_["n"] = String(nonce);
    replyScheduledAt_ = millis();
  }

  void remember(const JsonDocument& packet, int rssi) {
    const JsonString id = packet["id"].as<JsonString>();
    const JsonString ssid = packet["ssid"].as<JsonString>();
    if (!LoraAuth::hex(id, 12) || ssid.size() == 0 || ssid.size() > 32 ||
        !validProvisioningText(ssid.c_str(), ssid.size())) return;
    for (size_t index = 0; index < offerCount_; ++index) {
      if (strcmp(offers_[index].id, id.c_str()) == 0) {
        if (rssi > offers_[index].rssi) offers_[index].rssi = rssi;
        return;
      }
    }
    if (offerCount_ == sizeof(offers_) / sizeof(offers_[0])) return;
    Offer& offer = offers_[offerCount_++];
    strlcpy(offer.ssid, ssid.c_str(), sizeof(offer.ssid));
    strlcpy(offer.id, id.c_str(), sizeof(offer.id));
    offer.rssi = rssi;
  }
};

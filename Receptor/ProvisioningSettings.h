#pragma once

#include <stddef.h>

struct ProvisionedWifi {
  char ssid[33]{};
  char password[65]{};
};

struct LegacyProvisioningSettings {
  char name[33]{};
  ProvisionedWifi wifi;
  bool wifiSaved = false;
};

struct ProvisionedLora {
  char ssid[33]{};
  char password[65]{};
  char receiverId[13]{};

  bool enabled() const { return ssid[0] != '\0'; }
};

struct ProvisioningSettings : LegacyProvisioningSettings {
  ProvisionedLora lora;
};

constexpr bool validProvisioningText(const char* value, size_t length) {
  if (!value) return false;
  for (size_t index = 0; index < length; ++index) {
    const auto byte = static_cast<unsigned char>(value[index]);
    if (byte < 32 || byte == 127) return false;
  }
  return true;
}

constexpr bool validWifiPassword(const char* value, size_t length) {
  if (!validProvisioningText(value, length)) return false;
  if (length == 0 || (length >= 8 && length <= 63)) return true;
  if (length != 64) return false;
  for (size_t index = 0; index < length; ++index) {
    const char byte = value[index];
    if (!((byte >= '0' && byte <= '9') || (byte >= 'a' && byte <= 'f') ||
          (byte >= 'A' && byte <= 'F'))) return false;
  }
  return true;
}

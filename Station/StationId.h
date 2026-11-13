#pragma once

#include <stddef.h>

// O identificador precisa passar pela mesma validação na Station, no Access Point e no backend.
constexpr bool isValidStationId(const char* id, size_t length) {
  if (!id || length == 0 || length > 24) return false;

  for (size_t index = 0; index < length; ++index) {
    const char value = id[index];
    if (!((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z') ||
          (value >= '0' && value <= '9') || value == '_' || value == '-')) return false;
  }
  return true;
}

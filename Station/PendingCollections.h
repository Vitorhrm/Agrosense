#pragma once

#include <ArduinoJson.h>
#include <Preferences.h>
#include "RadioLink.h"

// Persiste leituras brutas para poder reassiná-las se a rede LoRa mudar.
class PendingCollections {
 public:
  static constexpr size_t CAPACITY = 24;
  static constexpr size_t DRAIN_LIMIT = 4;

  void begin() {
    ready_ = storage_.begin("agro-queue", false);
    if (!ready_) return;
    if (storage_.getBytesLength("queue-v1") == sizeof(state_)) {
      if (storage_.getBytes("queue-v1", &state_, sizeof(state_)) == sizeof(state_) &&
          state_.head < CAPACITY && state_.count <= CAPACITY) return;
    }
    state_ = {};
  }

  bool append(const JsonDocument& reading) {
    if (!ready_ || reading.overflowed() || measureJson(reading) >= sizeof(state_.frames[0])) return false;
    const bool full = state_.count == CAPACITY;
    const size_t tail = (state_.head + state_.count) % CAPACITY;
    scratch_ = state_;
    State& next = scratch_;
    serializeJson(reading, next.frames[tail], sizeof(next.frames[tail]));
    if (full) next.head = (next.head + 1) % CAPACITY;
    else ++next.count;
    if (!persist(next)) return false;
    if (full) Serial.println("Fila cheia: a coleta mais antiga foi descartada.");
    return true;
  }

  bool empty() const { return state_.count == 0; }

  bool front(JsonDocument& reading) const {
    if (empty()) return false;
    const char* frame = state_.frames[state_.head];
    return memchr(frame, 0, sizeof(state_.frames[0])) && !deserializeJson(reading, frame);
  }

  bool pop() {
    if (empty()) return false;
    scratch_ = state_;
    State& next = scratch_;
    next.frames[next.head][0] = 0;
    next.head = (next.head + 1) % CAPACITY;
    --next.count;
    return persist(next);
  }

 private:
  struct State {
    uint8_t head = 0;
    uint8_t count = 0;
    char frames[CAPACITY][RadioLink::MAX_JSON_BYTES + 1]{};
  };

  bool persist(const State& next) {
    // Só troca o estado em memória depois que a gravação da fila inteira foi confirmada.
    if (storage_.putBytes("queue-v1", &next, sizeof(next)) != sizeof(next)) return false;
    state_ = next;
    return true;
  }

  Preferences storage_;
  State state_;
  State scratch_; // Evita copiar o bloco de flash para a pilha da tarefa Arduino.
  bool ready_ = false;
};

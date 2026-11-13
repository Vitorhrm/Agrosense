#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <WiFi.h>
#include <esp_system.h>
#include <time.h>

#if __has_include("CloudConfig.local.h")
#include "CloudConfig.local.h"
#else
#include "CloudConfig.example.h"
#endif

// Fila em RAM: o envio HTTPS ocorre em outra tarefa para preservar a recepcao LoRa.
class CloudUploader {
 public:
  // Prepara o relogio TLS e inicia o trabalhador somente quando existe token configurado.
  void begin() {
    if (strlen(CLOUD_INGEST_TOKEN) < 32 || strncmp(CLOUD_READINGS_URL, "https://", 8) != 0) {
      Serial.println("Nuvem nao configurada. Preencha CloudConfig.local.h. Recepcao local continua ativa.");
      return;
    }
    configTime(0, 0, "pool.ntp.org", "time.google.com"); // Hora UTC para validar certificados HTTPS.
    queue_ = xQueueCreate(QUEUE_CAPACITY, sizeof(PendingReading));
    if (!queue_) { Serial.println("Nuvem: sem memoria para fila."); return; }
    if (xTaskCreate(workerEntry, "agro-upload", 12288, this, 1, nullptr) != pdPASS) {
      vQueueDelete(queue_); queue_ = nullptr;
      Serial.println("Nuvem: nao foi possivel iniciar tarefa de envio.");
      return;
    }
    Serial.println("Nuvem: envio HTTPS habilitado. Aguardando Wi-Fi e sincronizacao de hora.");
  }

  // Preserva o UUID autenticado do radio ou gera um para a coleta legada.
  bool enqueue(const JsonDocument& reading, const char* authenticatedEventId) {
    if (!queue_) return false;
    JsonDocument payload; // Copia independente do buffer que sera reutilizado pelo radio.
    for (const char* field : {"v", "node", "seq", "uptime_ms", "temp_c", "air_rh_pct",
                              "pressure_hpa", "soil_raw", "soil_enabled", "signal"}) {
      payload[field] = reading[field];
    }
    if (!reading["soil_index_pct"].isNull()) payload["soil_index_pct"] = reading["soil_index_pct"];
    char eventId[37];
    if (!authenticatedEventId) {
      uint8_t uuid[16];
      esp_fill_random(uuid, sizeof(uuid));
      uuid[6] = (uuid[6] & 0x0f) | 0x40;
      uuid[8] = (uuid[8] & 0x3f) | 0x80;
      snprintf(eventId, sizeof(eventId),
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        uuid[0], uuid[1], uuid[2], uuid[3], uuid[4], uuid[5], uuid[6], uuid[7],
        uuid[8], uuid[9], uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15]);
    }
    payload["event_id"] = authenticatedEventId ? authenticatedEventId : eventId;
    PendingReading pending{}; // Registro completo que sera copiado para a fila.
    if (payload.overflowed() || measureJson(payload) >= sizeof(pending.json)) {
      Serial.println("Nuvem: coleta excede o buffer de envio."); return false;
    }
    serializeJson(payload, pending.json, sizeof(pending.json));
    if (xQueueSend(queue_, &pending, 0) != pdTRUE) {
      Serial.println("Nuvem: fila cheia; esta coleta ficou apenas no Serial.");
      return false;
    }
    return true;
  }

 private:
  static constexpr size_t QUEUE_CAPACITY = 12; // Armazena ate 12 coletas, alem da coleta em envio.
  struct PendingReading { char json[512]; }; // JSON completo com identificador para deduplicacao.
  QueueHandle_t queue_ = nullptr; // Fila limitada, compartilhada de forma segura entre tarefas.

  // Adaptador exigido pelo FreeRTOS para executar o metodo da instancia.
  static void workerEntry(void* instance) { static_cast<CloudUploader*>(instance)->run(); }

  // Envia uma coleta com certificado validado; nunca imprime tokens nem respostas privadas.
  int send(const char* json) {
    NetworkClientSecure client; // Cliente TLS com o conjunto de autoridades do core ESP32.
    client.useBuiltinCACertBundle();
    client.setHandshakeTimeout(10);
    HTTPClient http; // Uma conexao por tentativa, encerrada ao terminar.
    http.setConnectTimeout(10000);
    http.setTimeout(10000);
    if (!http.begin(client, CLOUD_READINGS_URL)) return -1;
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + CLOUD_INGEST_TOKEN);
    const int status = http.POST(String(json));
    http.end();
    return status;
  }

  // Aguarda rede/hora e tenta cada coleta ate tres vezes sem bloquear o loop do radio.
  void run() {
    PendingReading pending{}; // Coleta em processamento fora da fila.
    for (;;) {
      if (xQueueReceive(queue_, &pending, portMAX_DELAY) != pdTRUE) continue;
      uint8_t attempts = 0; // Conta somente tentativas HTTP; falta de rede nao consome tentativa.
      while (attempts < 3) {
        if (WiFi.status() != WL_CONNECTED || time(nullptr) < 1700000000) {
          vTaskDelay(pdMS_TO_TICKS(1000)); continue;
        }
        const int status = send(pending.json); // Codigo HTTP ou codigo negativo de erro de transporte.
        ++attempts;
        if (status == 200 || status == 201) {
          Serial.println("Nuvem: coleta entregue."); break;
        }
        Serial.printf("Nuvem: falha no envio (codigo %d, tentativa %u/3).\n", status, attempts);
        if (status >= 400 && status < 500 && status != 408 && status != 429) break;
        vTaskDelay(pdMS_TO_TICKS(1000 * attempts));
      }
    }
  }
};

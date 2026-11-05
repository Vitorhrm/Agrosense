#include <Arduino.h>
#include <ArduinoJson.h>
#include <math.h>
#include "RadioLink.h"

constexpr int LORA_RX_PIN = 16; // Recebe do TX do LoRa.
constexpr int LORA_TX_PIN = 17; // Envia ao RX do LoRa.
constexpr uint32_t LORA_BAUD_RATE = 9600; // Baud configurado na UART do modem local.
HardwareSerial loraSerial(2); // UART dedicada ao modem.
RadioLink radio(loraSerial); // Transporte que separa JSON do byte binario de RSSI.
bool radioReady = false; // Evita interpretar bytes sem configuracao RSSI confirmada.

// Aplica exatamente os limites pedidos, sem media, SNR ou percentual de entrega.
const char* classifySignal(int rssiDbm) {
  if (rssiDbm >= -60) return "Muito próximo";
  if (rssiDbm >= -90) return "Bom";
  if (rssiDbm >= -115) return "Regular";
  if (rssiDbm >= -130) return "Zona de limite";
  return "Crítico";
}

// Valida uma leitura ambiental: permite null para falha, mas rejeita texto e valores fora da faixa.
bool validReading(JsonVariantConst reading, float minimum, float maximum) {
  if (reading.isUnbound()) return false;
  if (reading.isNull()) return true;
  if (!reading.is<float>()) return false;
  const float value = reading.as<float>(); // Valor numerico cuja unidade vem do protocolo.
  return isfinite(value) && value >= minimum && value <= maximum;
}

// Associa o RSSI deste pacote a station identificada nele e imprime apenas o nome do sinal.
void handleCollection(JsonDocument& message, int rssiDbm) {
  if (message["v"] != 1 || !message["node"].is<const char*>() ||
      strlen(message["node"].as<const char*>()) == 0 ||
      strlen(message["node"].as<const char*>()) > 24 ||
      !message["seq"].is<uint32_t>() || !message["uptime_ms"].is<uint32_t>() ||
      !message["soil_raw"].is<int>() || !message["soil_enabled"].is<bool>() ||
      message["soil_raw"].as<int>() < 0 || message["soil_raw"].as<int>() > 4095 ||
      (!message["soil_enabled"].as<bool>() && message["soil_raw"].as<int>() != 0) ||
      !validReading(message["temp_c"], -40, 85) ||
      !validReading(message["air_rh_pct"], 0, 100) ||
      !validReading(message["pressure_hpa"], 300, 1100)) {
    Serial.println("Mensagem ignorada: formato desconhecido.");
    return;
  }
  message["signal"] = classifySignal(rssiDbm); // Calculado aqui para esta coleta, sem numeros RF.
  if (message.overflowed()) { Serial.println("ERRO: memoria insuficiente para o JSON."); return; }
  serializeJson(message, Serial); // Exemplo: {"node":"station1",...,"signal":"Bom"}
  Serial.println();
}

// Habilita RSSI anexado no receptor e verifica a resposta AT antes de receber coletas.
void setup() {
  Serial.begin(115200);
  radioReady = radio.begin(LORA_RX_PIN, LORA_TX_PIN, LORA_BAUD_RATE, true);
  Serial.println(radioReady ? "Receptor pronto. RSSI classificado por station. Serial: 115200."
      : "ERRO: modem sem configuracao RSSI confirmada. Confira ligacoes/baud e reinicie.");
  if (!radioReady) {
    Serial.printf("Diagnostico UART ativo a %lu baud: texto digitado aqui sera enviado ao LoRa.\n",
                  static_cast<unsigned long>(LORA_BAUD_RATE));
    Serial.println("Use Both NL & CR no Monitor Serial. Tente +++ e depois AT, separadamente.");
    Serial.println("Bytes recebidos serao exibidos abaixo em texto/hex. Nenhum RSSI sera inventado.");
  }
}

// Ponte de diagnostico: permite testar o modem pelo Monitor Serial quando a configuracao falha.
void diagnoseModem() {
  while (Serial.available()) loraSerial.write(static_cast<uint8_t>(Serial.read()));
  if (loraSerial.available()) {
    Serial.print("LoRa RX: ");
    while (loraSerial.available()) {
      const uint8_t value = loraSerial.read(); // Preserva bytes para diagnosticar baud incorreto.
      if (value >= 32 && value <= 126) Serial.write(value);
      else Serial.printf("<%02X>", value);
    }
    Serial.println();
  }
}

// Cada mensagem tem seu RSSI e identificador; nao mistura valores entre stations.
void loop() {
  if (!radioReady) { diagnoseModem(); delay(1); return; }
  JsonDocument message; // Coleta recebida da station.
  int receivedRssi = 0; // Valor interno em dBm, nao incluido no JSON de saida.
  while (radio.receive(message, receivedRssi)) handleCollection(message, receivedRssi);
  delay(1);
}

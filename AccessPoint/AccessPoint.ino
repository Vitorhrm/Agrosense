#include <Arduino.h>
#include <ArduinoJson.h>
#include <math.h>
#include "RadioLink.h"
#include "ReceiverWifi.h"
#include "CloudUploader.h"
#include "StationId.h"
#include "BleProvisioning.h"

constexpr int LORA_RX_PIN = 16; // Recebe do TX do LoRa.
constexpr int LORA_TX_PIN = 17; // Envia ao RX do LoRa.
constexpr uint32_t LORA_BAUD_RATE = 9600; // Baud configurado na UART do modem local.
HardwareSerial loraSerial(2); // UART dedicada ao modem.
RadioLink radio(loraSerial); // Transporte que separa JSON do byte binario de RSSI.
bool radioReady = false; // Evita interpretar bytes sem configuracao RSSI confirmada.
ReceiverWifi receiverWifi; // Gerencia a conexao ao roteador sem esperar no loop LoRa.
CloudUploader cloudUploader; // Envia coletas validadas em uma tarefa separada.
BleProvisioning provisioning(radio, receiverWifi);

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
bool handleCollection(JsonDocument& message, int rssiDbm, const char* eventId) {
  const JsonString node = message["node"].as<JsonString>();
  const JsonVariantConst soilIndex = message["soil_index_pct"];
  if (message["v"] != 1 || !isValidStationId(node.c_str(), node.size()) ||
      !message["seq"].is<uint32_t>() || !message["uptime_ms"].is<uint32_t>() ||
      !message["soil_raw"].is<int>() || !message["soil_enabled"].is<bool>() ||
      message["soil_raw"].as<int>() < 0 || message["soil_raw"].as<int>() > 4095 ||
      (!message["soil_enabled"].as<bool>() && message["soil_raw"].as<int>() != 0) ||
      (!soilIndex.isUnbound() && (!message["soil_enabled"].as<bool>() ||
          soilIndex.isNull() || !validReading(soilIndex, 0, 100))) ||
      !validReading(message["temp_c"], -40, 85) ||
      !validReading(message["air_rh_pct"], 0, 100) ||
      !validReading(message["pressure_hpa"], 300, 1100)) {
    Serial.println("Mensagem ignorada: formato desconhecido.");
    return false;
  }
  message["signal"] = classifySignal(rssiDbm); // Calculado aqui para esta coleta, sem numeros RF.
  if (message.overflowed()) { Serial.println("ERRO: memoria insuficiente para o JSON."); return false; }
  serializeJson(message, Serial); // Exemplo: {"node":"station1",...,"signal":"Bom"}
  Serial.println();
  return cloudUploader.enqueue(message, eventId); // Copia o JSON e o identificador para envio HTTPS.
}

// O ACK libera a coleta na Station assim que ela entra na fila em RAM do Access Point.
// A persistência no banco acontece depois, quando o envio HTTPS é confirmado.
char lastQueuedReceipt[25]{};
char lastQueuedNetworkProof[25]{};

// Identidade da coleta independe da senha e do modo de pareamento.
bool collectionEventId(JsonString node, JsonString sample, char (&eventId)[37]) {
  if (!isValidStationId(node.c_str(), node.size()) || !LoraAuth::hex(sample, 16)) return false;
  char canonical[48];
  snprintf(canonical, sizeof(canonical), "%s|%s", node.c_str(), sample.c_str());
  const auto* algorithm = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  uint8_t digest[32];
  if (!algorithm || mbedtls_md(algorithm, reinterpret_cast<const uint8_t*>(canonical),
      strlen(canonical), digest) != 0) return false;
  char hex[33];
  LoraAuth::encode(digest, 16, hex);
  snprintf(eventId, sizeof(eventId), "%.8s-%.4s-%.4s-%.4s-%.12s",
      hex, hex + 8, hex + 12, hex + 16, hex + 20);
  return true;
}

bool alreadyQueued(const char* receipt, const ProvisionedLora& network) {
  if (strcmp(lastQueuedReceipt, receipt) != 0) return false;
  if (!network.enabled()) return lastQueuedNetworkProof[0] == 0;
  char proof[25];
  return LoraAuth::proof("collection-ack-v1", network, receipt, proof) &&
      strcmp(lastQueuedNetworkProof, proof) == 0;
}

void sendCollectionAck(const char* receipt, const ProvisionedLora& network) {
  JsonDocument ack;
  ack["l"] = "ack";
  ack["receipt"] = receipt;
  char proof[25]{};
  if (network.enabled()) {
    if (!LoraAuth::proof("collection-ack-v1", network, receipt, proof)) return;
    ack["h"] = String(proof);
  }
  strlcpy(lastQueuedReceipt, receipt, sizeof(lastQueuedReceipt));
  strlcpy(lastQueuedNetworkProof, proof, sizeof(lastQueuedNetworkProof));
  radio.send(ack);
}

// Habilita RSSI anexado no Access Point e verifica a resposta AT antes de receber coletas.
void setup() {
  Serial.begin(115200);
  provisioning.load("AgroSense-AccessPoint", WIFI_SSID, WIFI_PASSWORD);
  if (provisioning.loraNetwork().enabled()) receiverWifi.begin(provisioning.initialWifi());
  cloudUploader.begin(); // Token e URL ficam em CloudConfig.local.h, separado das chaves da IA.
  radioReady = radio.begin(LORA_RX_PIN, LORA_TX_PIN, LORA_BAUD_RATE, true);
  Serial.println(radioReady ? "Access Point pronto. RSSI classificado por station. Serial: 115200."
      : "ERRO: modem sem configuracao RSSI confirmada. Confira ligacoes/baud e reinicie.");
  if (!radioReady) {
    Serial.printf("Diagnostico UART ativo a %lu baud: texto digitado aqui sera enviado ao LoRa.\n",
                  static_cast<unsigned long>(LORA_BAUD_RATE));
    Serial.println("Use Both NL & CR no Monitor Serial. Tente +++ e depois AT, separadamente.");
    Serial.println("Bytes recebidos serao exibidos abaixo em texto/hex. Nenhum RSSI sera inventado.");
  }
  provisioning.setWifiConnected(receiverWifi.isConnected());
  provisioning.begin("AgroSense-AccessPoint", true, "", radioReady);
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
  receiverWifi.update(); // Reconecta mesmo quando o radio esta em diagnostico.
  provisioning.setWifiConnected(receiverWifi.isConnected());
  provisioning.update();
  if (!radioReady) { diagnoseModem(); delay(1); return; }
  JsonDocument message; // Coleta recebida da station.
  int receivedRssi = 0; // Valor interno em dBm, nao incluido no JSON de saida.
  while (radio.receive(message, receivedRssi)) {
    if (provisioning.handleRadio(message, receivedRssi)) continue;
    const auto& network = provisioning.loraNetwork();
    if (!network.enabled()) {
      const JsonString request = message["b"].as<JsonString>();
      if (!LoraAuth::hex(request, 16)) {
        handleCollection(message, receivedRssi, nullptr); // Compatibilidade com Station antiga.
      } else {
        char eventId[37];
        if (collectionEventId(message["node"].as<JsonString>(), request, eventId) &&
            (alreadyQueued(request.c_str(), network) || handleCollection(message, receivedRssi, eventId))) {
          sendCollectionAck(request.c_str(), network);
        }
      }
    } else {
      JsonDocument reading;
      char eventId[37]{};
      if (LoraAuth::decodeReading(message, network, reading, eventId)) {
        const char* receipt = message["h"].as<const char*>();
        if (collectionEventId(message["node"].as<JsonString>(), message["b"].as<JsonString>(), eventId) &&
            (alreadyQueued(receipt, network) || handleCollection(reading, receivedRssi, eventId))) {
          sendCollectionAck(receipt, network);
        }
      }
    }
  }
  delay(1);
}

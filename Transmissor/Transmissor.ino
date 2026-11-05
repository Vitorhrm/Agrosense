#include <Arduino.h>
// Tempo entre inicios de coleta e envio: 10000 ms = 10 segundos.
constexpr uint32_t COLLECTION_INTERVAL_MS = 10000;
constexpr char NODE_ID[] = "station1"; // Nome UNICO por station: station1, station2 etc.
constexpr bool SOIL_SENSOR_ENABLED = true; // Sensor de solo conectado ao GPIO34.
constexpr int SOIL_ANALOG_PIN = 34; // Entrada analogica AO do sensor de solo.
constexpr int I2C_SDA_PIN = 21; // SDA do modulo AHT20 + BMP280.
constexpr int I2C_SCL_PIN = 22; // SCL do modulo AHT20 + BMP280.
constexpr int LORA_RX_PIN = 16; // Recebe do TX do LoRa.
constexpr int LORA_TX_PIN = 17; // Envia ao RX do LoRa.
constexpr uint32_t LORA_BAUD_RATE = 9600; // Deve coincidir com a UART do modem local.
static_assert(sizeof(NODE_ID) > 1 && sizeof(NODE_ID) <= 25, "NODE_ID deve ter de 1 a 24 bytes.");

#include "SensorReadings.h"
#include "RadioLink.h"

HardwareSerial loraSerial(2); // UART2 dedicada ao modem.
RadioLink radio(loraSerial); // Transporte UART e configuracao do modem.
SensorReadings sensors; // Leitura dos sensores ambientais.
bool radioReady = false; // Configuracao do modem confirmada.
bool firstCollection = true; // Coleta imediatamente apos a inicializacao.
uint32_t lastCollectionMs = 0; // Instante de inicio da ultima coleta.
uint32_t sequenceNumber = 0; // Numero da coleta, reiniciado a cada boot.

// Le os sensores e entrega um JSON ao modem; a intensidade sera medida no receptor.
void collectAndSend() {
  JsonDocument message; // Uma coleta; nao contem RSSI, SNR ou classificacao local.
  message["v"] = 1;
  message["node"] = NODE_ID;
  message["seq"] = ++sequenceNumber;
  message["uptime_ms"] = millis(); // Tempo desde o boot, nao horario de calendario.
  sensors.collect(message, SOIL_SENSOR_ENABLED, SOIL_ANALOG_PIN);
  if (!radio.send(message)) {
    Serial.println("ERRO: JSON excedeu o limite, faltou memoria ou houve falha na UART.");
    return;
  }
  loraSerial.flush(); // Confirma somente fim do envio UART, nao a entrega pelo ar.
  Serial.print("Coleta entregue ao modem: ");
  serializeJson(message, Serial);
  Serial.println();
}

// Prepara o modem transparente e os sensores; nao modifica canal, nivel ou chave RF.
void setup() {
  Serial.begin(115200);
  radioReady = radio.begin(LORA_RX_PIN, LORA_TX_PIN, LORA_BAUD_RATE, false);
  sensors.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (SOIL_SENSOR_ENABLED) {
    pinMode(SOIL_ANALOG_PIN, INPUT); // GPIO34 nao possui pull-up/pull-down interno.
    analogSetPinAttenuation(SOIL_ANALOG_PIN, ADC_11db); // Faixa ADC adequada a saida analogica em 3,3 V.
  }
  Serial.println(radioReady ? "Station pronta. Classificacao do sinal e feita no receptor."
      : "ERRO: modem sem configuracao confirmada. Confira ligacoes/baud e reinicie.");
}

// Agenda coletas; minimo de 2 segundos evita leituras ambientais excessivas.
void loop() {
  if (!radioReady) { delay(10); return; }
  const uint32_t now = millis(); // Relogio desta iteracao; subtracao suporta overflow.
  const uint32_t interval = COLLECTION_INTERVAL_MS < 2000 ? 2000 : COLLECTION_INTERVAL_MS;
  if (firstCollection || static_cast<uint32_t>(now - lastCollectionMs) >= interval) {
    firstCollection = false;
    lastCollectionMs = now;
    collectAndSend();
  }
  delay(1);
}

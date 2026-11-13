#include <Arduino.h>
#include <driver/rtc_io.h>
#include <driver/gpio.h>
#include <esp_sleep.h>
#include "StationId.h"
constexpr uint64_t SLEEP_INTERVAL_US = 15ULL * 60 * 1000000;
constexpr gpio_num_t LOAD_SWITCH_EN = GPIO_NUM_25;
constexpr uint8_t LOAD_SWITCH_ON = HIGH; // Inverta se a entrada EN for ativa em nivel baixo.
constexpr uint8_t LOAD_SWITCH_OFF = LOAD_SWITCH_ON == HIGH ? LOW : HIGH;
constexpr uint32_t POWER_SETTLE_MS = 1000;
constexpr uint32_t ACK_TIMEOUT_MS = 4500;
constexpr uint8_t MAX_SEND_ATTEMPTS = 3;
constexpr int STATION_LED_PIN = -1; // Configure o GPIO do LED se ele for controlavel.
constexpr uint8_t STATION_LED_OFF = LOW;
static_assert(STATION_LED_PIN != LOAD_SWITCH_EN, "LED e EN precisam de pinos distintos.");
constexpr char NODE_ID[] = "station1"; // Nome UNICO por station: station1, station2 etc.
constexpr bool SOIL_SENSOR_ENABLED = true; // Sensor de solo conectado ao GPIO34.
constexpr int SOIL_ANALOG_PIN = 34; // Entrada analogica AO do sensor de solo.
constexpr int I2C_SDA_PIN = 21; // SDA do modulo AHT20 + BMP280.
constexpr int I2C_SCL_PIN = 22; // SCL do modulo AHT20 + BMP280.
constexpr int LORA_RX_PIN = 16; // Recebe do TX do LoRa.
constexpr int LORA_TX_PIN = 17; // Envia ao RX do LoRa.
constexpr uint32_t LORA_BAUD_RATE = 9600; // Deve coincidir com a UART do modem local.
static_assert(isValidStationId(NODE_ID, sizeof(NODE_ID) - 1),
              "NODE_ID deve ter de 1 a 24 caracteres de A-Z, a-z, 0-9, _ ou -.");

#include "SensorReadings.h"
#include "RadioLink.h"
#include "SoilCalibration.h"
#include "SoilCalibrationConfig.h"
#include "BleProvisioning.h"

HardwareSerial loraSerial(2); // UART2 dedicada ao modem.
RadioLink radio(loraSerial); // Transporte UART e configuracao do modem.
SensorReadings sensors; // Leitura dos sensores ambientais.
BleProvisioning provisioning(radio);
char bootId[17]{};
bool radioReady = false; // Configuracao do modem confirmada.


// Le os sensores e entrega um JSON ao modem; a intensidade sera medida no Access Point.
void collectAndSend() {
  JsonDocument message; // Uma coleta; nao contem RSSI, SNR ou classificacao local.
  message["v"] = 1;
  message["node"] = NODE_ID;
  message["seq"] = 1; // Uma coleta por despertar, com bootId exclusivo.
  message["uptime_ms"] = millis(); // Tempo desde o boot, nao horario de calendario.
  sensors.collect(message, SOIL_SENSOR_ENABLED, SOIL_ANALOG_PIN);
  if (SOIL_SENSOR_ENABLED) {
    const float soilIndex = SoilCalibration::relativeIndex(message["soil_raw"].as<int>(),
        SOIL_DRY_REFERENCE, SOIL_WET_REFERENCE); // Indice local, nao percentual volumetrico.
    if (isfinite(soilIndex)) {
      // Um decimal conserva o índice histórico sem ocupar bytes desnecessários no rádio.
      message["soil_index_pct"] = roundf(soilIndex * 10.0f) / 10.0f;
      Serial.printf("Solo: indice relativo %.1f/100 (referencias locais).\n", soilIndex);
    }
  }
  const auto& network = provisioning.loraNetwork();
  JsonDocument protectedMessage;
  const JsonDocument* wire = &message;
  const char* expectedReceipt = bootId;
  if (network.enabled()) {
    if (!LoraAuth::encodeReading(message, network, bootId, protectedMessage)) return;
    wire = &protectedMessage;
    expectedReceipt = protectedMessage["h"].as<const char*>();
  } else {
    message["b"] = bootId;
  }

  // Reenvia a mesma coleta para que o Access Point possa reconhecer duplicatas.
  for (uint8_t attempt = 0; attempt < MAX_SEND_ATTEMPTS; ++attempt) {
    if (!radio.send(*wire)) break;
    loraSerial.flush();
    const uint32_t started = millis();
    while (static_cast<uint32_t>(millis() - started) < ACK_TIMEOUT_MS) {
      JsonDocument reply;
      int rssi = 0;
      if (radio.receive(reply, rssi) && reply["l"] == "ack") {
        const JsonString receipt = reply["receipt"].as<JsonString>();
        char expectedProof[25];
        if (receipt.c_str() && receipt.size() == strlen(expectedReceipt) &&
            strcmp(receipt.c_str(), expectedReceipt) == 0 &&
            (!network.enabled() ||
             (LoraAuth::proof("collection-ack-v1", network, expectedReceipt, expectedProof) &&
              LoraAuth::matches(reply["h"].as<JsonString>(), expectedProof)))) {
          Serial.println("Coleta confirmada pelo Access Point.");
          return;
        }
      }
      delay(1);
    }
  }
  Serial.println("Access Point nao confirmou a coleta. A Station voltara a tentar no proximo ciclo.");
}

// Libera os sinais ligados aos dispositivos antes de cortar a alimentacao.
void sleepStation() {
  if (esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US) != ESP_OK) {
    Serial.println("Falha ao configurar o temporizador de deep sleep.");
    delay(1000);
    ESP.restart();
  }
  loraSerial.end();
  Wire.end();
  for (const int pin : {LORA_RX_PIN, LORA_TX_PIN, I2C_SDA_PIN, I2C_SCL_PIN, SOIL_ANALOG_PIN}) {
    pinMode(pin, INPUT);
  }
  if (STATION_LED_PIN >= 0) {
    digitalWrite(STATION_LED_PIN, STATION_LED_OFF);
    gpio_hold_en(static_cast<gpio_num_t>(STATION_LED_PIN));
    gpio_deep_sleep_hold_en();
  }
  digitalWrite(LOAD_SWITCH_EN, LOAD_SWITCH_OFF);
  // GPIO25 e RTC IO no ESP32 classico; o hold conserva EN no nivel desligado.
  rtc_gpio_init(LOAD_SWITCH_EN);
  rtc_gpio_set_direction(LOAD_SWITCH_EN, RTC_GPIO_MODE_OUTPUT_ONLY);
  rtc_gpio_set_level(LOAD_SWITCH_EN, LOAD_SWITCH_OFF);
  rtc_gpio_hold_en(LOAD_SWITCH_EN);
  Serial.flush();
  esp_deep_sleep_start();
}

void setup() {
  Serial.begin(115200);
  rtc_gpio_hold_dis(LOAD_SWITCH_EN);
  rtc_gpio_deinit(LOAD_SWITCH_EN);
  digitalWrite(LOAD_SWITCH_EN, LOAD_SWITCH_ON);
  pinMode(LOAD_SWITCH_EN, OUTPUT);
  digitalWrite(LOAD_SWITCH_EN, LOAD_SWITCH_ON);
  if (STATION_LED_PIN >= 0) {
    pinMode(STATION_LED_PIN, OUTPUT);
    digitalWrite(STATION_LED_PIN, STATION_LED_OFF);
    gpio_hold_dis(static_cast<gpio_num_t>(STATION_LED_PIN));
    gpio_deep_sleep_hold_dis();
  }

  const bool timerWake = esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER;
  delay(POWER_SETTLE_MS);
  provisioning.load("AgroSense-Station");
  radioReady = radio.begin(LORA_RX_PIN, LORA_TX_PIN, LORA_BAUD_RATE, true);
  sensors.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (SOIL_SENSOR_ENABLED) {
    pinMode(SOIL_ANALOG_PIN, INPUT);
    analogSetPinAttenuation(SOIL_ANALOG_PIN, ADC_11db);
  }

  uint8_t random[8];
  esp_fill_random(random, sizeof(random));
  LoraAuth::encode(random, sizeof(random), bootId);

  // Despertar normal nao inicializa BLE. Wi-Fi nao e usado na Station.
  if (timerWake) {
    if (radioReady) collectAndSend();
    sleepStation();
    return;
  }
  provisioning.begin("AgroSense-Station", false, NODE_ID, radioReady);
}

void loop() {
  if (radioReady) {
    JsonDocument packet;
    int rssi = 0;
    while (radio.receive(packet, rssi)) provisioning.handleRadio(packet, rssi);
  }
  provisioning.update();
  if (provisioning.configurationFinished()) {
    if (BLEDevice::getInitialized()) BLEDevice::deinit(false);
    if (radioReady) collectAndSend();
    sleepStation();
  }
  delay(1);
}
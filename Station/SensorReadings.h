#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "Aht20Reader.h"
#include <Adafruit_BMP280.h>
#include <ArduinoJson.h>
#include <math.h>

// Agrupa os sensores e impede que falhas sejam confundidas com medidas iguais a zero.
class SensorReadings {
 public:
  // Inicializa os sensores no mesmo barramento I2C; tenta os dois enderecos do BMP280.
  void begin(int sdaPin, int sclPin) {
    Wire.begin(sdaPin, sclPin);
    Wire.setTimeOut(100);
    ahtReady = aht.begin();
    bmpReady = bmp.begin(0x76) || bmp.begin(0x77);
    Serial.printf("AHT20: %s | BMP280: %s\n", ahtReady ? "OK" : "ausente", bmpReady ? "OK" : "ausente");
    analogReadResolution(12);
  }

  // Falhas ambientais geram null; solo desativado permanece zero, conforme solicitado.
  void collect(JsonDocument& document, bool soilEnabled, int soilPin) {
    document["temp_c"] = nullptr;
    document["air_rh_pct"] = nullptr;
    document["pressure_hpa"] = nullptr;
    document["soil_raw"] = 0;
    document["soil_enabled"] = soilEnabled;
    float temperature = NAN, humidity = NAN; // Valores definidos somente apos leitura com CRC valido.
    if (!ahtReady) ahtReady = aht.begin();
    if (ahtReady && aht.read(temperature, humidity)) {
      if (isfinite(temperature) && temperature >= -40 && temperature <= 85)
        document["temp_c"] = roundf(temperature * 100) / 100;
      else ahtReady = false;
      if (isfinite(humidity) && humidity >= 0 && humidity <= 100)
        document["air_rh_pct"] = roundf(humidity * 100) / 100;
      else ahtReady = false;
    } else {
      ahtReady = false;
    }
    if (!bmpReady) bmpReady = bmp.begin(0x76) || bmp.begin(0x77);
    if (bmpReady) {
      const float pressure = bmp.readPressure() / 100.0F; // Converte pascals em hectopascals.
      if (isfinite(pressure) && pressure >= 300 && pressure <= 1100)
        document["pressure_hpa"] = roundf(pressure * 100) / 100;
      else bmpReady = false;
    }
    if (soilEnabled) {
      uint32_t total = 0; // Soma varias amostras para reduzir ruido do ADC.
      for (uint8_t sample = 0; sample < 16; ++sample) total += analogRead(soilPin);
      document["soil_raw"] = total / 16;
      // Percentual exige calibracao no solo utilizado; envia o ADC bruto por enquanto.
    }
  }

 private:
  Aht20Reader aht; // Leitor AHT20 com prazo de espera e verificacao CRC.
  Adafruit_BMP280 bmp; // Driver de pressao atmosferica.
  bool ahtReady = false; // Indica se o AHT20 respondeu a inicializacao.
  bool bmpReady = false; // Indica se o BMP280 respondeu a inicializacao.
};

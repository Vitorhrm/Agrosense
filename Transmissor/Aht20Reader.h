#pragma once
#include <Arduino.h>
#include <Wire.h>

// Leitor AHT20 com prazo de espera e CRC-8 conforme o manual Aosong.
// Evita os loops BUSY sem limite presentes no driver AHTX0 instalado.
class Aht20Reader {
 public:
  // Confere calibracao; inicializa somente quando o sensor informa que e necessario.
  bool begin() {
    delay(40); // Estabilizacao minima apos energizacao.
    uint8_t status = 0; // Byte de estado do sensor.
    if (!waitReady(status)) return false;
    if ((status & 0x08) == 0) {
      const uint8_t initialize[] = {0xBE, 0x08, 0x00}; // Inicializacao especifica do AHT20.
      if (!writeCommand(initialize, sizeof(initialize))) return false;
      delay(10);
      if (!waitReady(status) || (status & 0x08) == 0) return false;
    }
    return true;
  }

  // Mede temperatura e umidade; retorna false em falha I2C, timeout ou CRC incorreto.
  bool read(float& temperatureC, float& humidityPct) {
    const uint8_t trigger[] = {0xAC, 0x33, 0x00}; // Disparo de uma nova conversao.
    if (!writeCommand(trigger, sizeof(trigger))) return false;
    delay(80); // Tempo de conversao informado pelo fabricante.
    uint8_t status = 0;
    if (!waitReady(status) || (status & 0x08) == 0) return false;
    uint8_t data[7]{}; // Status + 5 bytes de medidas + CRC.
    if (Wire.requestFrom(ADDRESS, static_cast<uint8_t>(sizeof(data))) != sizeof(data)) {
      while (Wire.available()) Wire.read();
      return false;
    }
    for (size_t index = 0; index < sizeof(data); ++index) data[index] = Wire.read();
    if ((data[0] & 0x88) != 0x08 || crc8(data, 6) != data[6]) return false;
    const uint32_t rawHumidity = (static_cast<uint32_t>(data[1]) << 12) |
        (static_cast<uint32_t>(data[2]) << 4) | (data[3] >> 4); // Medida de 20 bits.
    const uint32_t rawTemperature = (static_cast<uint32_t>(data[3] & 0x0F) << 16) |
        (static_cast<uint32_t>(data[4]) << 8) | data[5]; // Medida de 20 bits.
    humidityPct = rawHumidity * (100.0F / 1048576.0F);
    temperatureC = rawTemperature * (200.0F / 1048576.0F) - 50.0F;
    return true;
  }

 private:
  static constexpr uint8_t ADDRESS = 0x38; // Endereco I2C fixo do AHT20.
  static constexpr uint32_t READY_TIMEOUT_MS = 300; // Limite do polling BUSY, alem do timeout I2C.

  // Envia os bytes de um comando e verifica o ACK do sensor.
  bool writeCommand(const uint8_t* data, size_t size) {
    Wire.beginTransmission(ADDRESS);
    Wire.write(data, size);
    return Wire.endTransmission() == 0;
  }

  // Aguarda BUSY limpar, abortando imediatamente em falha de leitura.
  bool waitReady(uint8_t& status) {
    const uint32_t start = millis(); // Inicio do prazo de espera.
    do {
      if (Wire.requestFrom(ADDRESS, static_cast<uint8_t>(1)) != 1) return false;
      status = Wire.read();
      if ((status & 0x80) == 0) return true;
      delay(10);
    } while (static_cast<uint32_t>(millis() - start) < READY_TIMEOUT_MS);
    return false;
  }

  // CRC-8: valor inicial 0xFF e polinomio 0x31, conforme o datasheet.
  static uint8_t crc8(const uint8_t* data, size_t size) {
    uint8_t crc = 0xFF; // Acumulador de verificacao dos bytes do sensor.
    for (size_t index = 0; index < size; ++index) {
      crc ^= data[index];
      for (uint8_t bit = 0; bit < 8; ++bit) crc = (crc & 0x80) ? (crc << 1) ^ 0x31 : crc << 1;
    }
    return crc;
  }
};

#include <Arduino.h>
#include <math.h>
#include <driver/rtc_io.h>

constexpr gpio_num_t LOAD_SWITCH_EN = GPIO_NUM_25;
constexpr uint8_t LOAD_SWITCH_ON = HIGH; // Mesma polaridade usada pela Station.
constexpr int SOIL_PIN = 34; // AO do sensor na mesma entrada usada pela Station.
constexpr uint32_t SAMPLE_INTERVAL_MS = 1000; // Intervalo entre conjuntos de amostras.
constexpr uint16_t SAMPLE_COUNT = 64; // Amostras por conjunto para observar ruido e media.
int dryReference = -1; // Referencia seca capturada com D; perdida ao reiniciar.
int wetReference = -1; // Referencia saturada capturada com M; perdida ao reiniciar.
uint32_t lastSampleMs = 0; // Agenda leituras, sem comandos bloqueantes de entrada serial.

// Mede o ADC bruto com a mesma resolucao/atenuacao do firmware da station.
int readSoilAverage() {
  uint32_t total = 0; // Acumulador de amostras.
  int minimum = 4095, maximum = 0; // Amplitude observada para avaliar a estabilidade.
  for (uint16_t i = 0; i < SAMPLE_COUNT; ++i) {
    const int value = analogRead(SOIL_PIN);
    total += value;
    minimum = min(minimum, value); maximum = max(maximum, value);
    delay(2); // Pequeno espacamento de amostras; este sketch nao recebe LoRa.
  }
  const int average = total / SAMPLE_COUNT;
  Serial.printf("ADC medio=%d | minimo=%d | maximo=%d\n", average, minimum, maximum);
  return average;
}

// Exibe as constantes para copiar, somente quando as duas referencias foram medidas.
void printReferences() {
  if (dryReference < 0 || wetReference < 0 || dryReference == wetReference) {
    Serial.println("Calibracao incompleta: capture D e M com valores diferentes."); return;
  }
  Serial.println("Copie para Station/SoilCalibrationConfig.h e grave a Station novamente:");
  Serial.printf("constexpr int SOIL_DRY_REFERENCE = %d;\n", dryReference);
  Serial.printf("constexpr int SOIL_WET_REFERENCE = %d;\n", wetReference);
  Serial.println("Indice relativo: 0=referencia seca; 100=referencia saturada. Nao e teor volumetrico.");
}

// Inicia apenas o ADC e o Serial; nao configura radio, Wi-Fi ou sensores I2C.
void setup() {
  Serial.begin(115200);
  rtc_gpio_hold_dis(LOAD_SWITCH_EN);
  rtc_gpio_deinit(LOAD_SWITCH_EN);
  pinMode(LOAD_SWITCH_EN, OUTPUT);
  digitalWrite(LOAD_SWITCH_EN, LOAD_SWITCH_ON);
  delay(1000);
  pinMode(SOIL_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
  Serial.println("CALIBRACAO SOLO GPIO34 | D: capturar seco | M: capturar saturado | P: mostrar referencias");
  Serial.println("Use o mesmo solo e profundidade. Aguarde estabilizar. Nao molhe os componentes da placa.");
}

// Mostra leituras e captura referencias somente ao comando do operador.
void loop() {
  while (Serial.available()) {
    const char command = Serial.read(); // CR/LF e caracteres desconhecidos sao ignorados.
    if (command == 'D' || command == 'd') { dryReference = readSoilAverage(); Serial.println("Referencia seca capturada."); }
    if (command == 'M' || command == 'm') { wetReference = readSoilAverage(); Serial.println("Referencia saturada capturada."); }
    if (command == 'P' || command == 'p') printReferences();
  }
  if (static_cast<uint32_t>(millis() - lastSampleMs) >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = millis(); readSoilAverage();
  }
  delay(1);
}

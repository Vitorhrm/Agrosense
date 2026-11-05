#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

// Transporte para DX-LR32: cada JSON + LF deve caber em um pacote de 230 bytes.
class RadioLink {
 public:
  static constexpr size_t MAX_JSON_BYTES = 229; // Um byte adicional e reservado ao LF.
  explicit RadioLink(HardwareSerial& port) : serial(port) {}

  // Habilita o byte RSSI e fixa o tamanho do pacote; falha impede uso de dados ambiguos.
  bool begin(int rxPin, int txPin, uint32_t baudRate, bool enableRssi = true) {
    ready = false;
    reset();
    serial.setRxBufferSize(1024); // Absorve pequenas rajadas de mais de uma station.
    serial.setTxBufferSize(512); // Enfileira JSON + LF sem pausa entre bytes.
    serial.begin(baudRate, SERIAL_8N1, rxPin, txPin);
    delay(2500);
    Serial.println("Configurando LoRa: o primeiro AT pode nao responder se o modulo estiver em modo de dados.");
    // Detecta AT ja ativo; a tentativa pode ser irradiada se o radio estiver transparente.
    if (!command("AT", "OK")) {
      delay(1200); // Deixa o modem concluir eventual transmissao do teste anterior.
      serial.print("+++\r\n"); // Terminacao de comando documentada: CR + LF.
      serial.flush();
      const String entryResponse = readResponse(2000);
      printResponse("Entrada no modo AT", entryResponse);
      if (entryResponse.indexOf("Exit AT") >= 0) {
        delay(2500); // O modem estava em AT e o escape o reiniciou; entra novamente.
        serial.print("+++\r\n");
        serial.flush();
        printResponse("Nova entrada no modo AT", readResponse(2000));
      }
      if (!command("AT", "OK")) {
        Serial.println("Sem AT valido apos o escape. Confira TX/RX cruzados, GND, alimentacao, baud e modo M0/M1.");
        return false;
      }
    }
    // Consulta antes de escrever: evita regravar parametros corretos a cada boot.
    if (!ensureSetting("AT+MODE", "+MODE=0", "AT+MODE0") ||
        !ensureSetting("AT+PACKET", "+PACKET=3", "AT+PACKET3") ||
        !ensureSetting("AT+SLEEP", "+SLEEP=2", "AT+SLEEP2") ||
        !ensureSetting("AT+DRSSI", enableRssi ? "+DRSSI=1" : "+DRSSI=0",
                       enableRssi ? "AT+DRSSI1" : "AT+DRSSI0")) return false;
    serial.print("+++\r\n"); // Sair do modo AT reinicia o modem e aplica as configuracoes.
    serial.flush();
    const String response = readResponse(2000);
    printResponse("Saida do modo AT", response);
    if (!hasLine(response, "Exit AT")) return false; // Power On sozinho nao confirma saida de AT.
    delay(1000);
    while (serial.available()) serial.read();
    ready = true;
    return true;
  }

  // Entrega JSON e LF em uma unica escrita para evitar fracionamento entre pacotes RF.
  bool send(const JsonDocument& message) {
    const size_t expectedLength = measureJson(message); // Tamanho em bytes, incluindo UTF-8.
    if (!ready || message.overflowed() || expectedLength == 0 || expectedLength > MAX_JSON_BYTES) return false;
    uint8_t packet[MAX_JSON_BYTES + 1]; // Pacote UART completo, sem terminador nulo.
    const size_t length = serializeJson(message, packet, MAX_JSON_BYTES + 1);
    if (length != expectedLength) return false;
    packet[length] = '\n';
    return serial.write(packet, length + 1) == length + 1;
  }

  // Recebe JSON + LF seguido do byte BINARIO de RSSI acrescentado pelo modem.
  // O byte RSSI pode inclusive ser LF, CR ou '{'; nunca deve ser tratado como texto.
  bool receive(JsonDocument& message, int& rssiDbm) {
    if (!ready) return false;
    if ((length || awaitingRssi || dropping) && static_cast<uint32_t>(millis() - lastByteMs) > 5000) {
      Serial.println("Pacote incompleto: JSON ou byte RSSI ausente; descarte sem classificacao.");
      reset();
    }
    while (serial.available()) {
      const uint8_t incoming = serial.read(); // Byte bruto recebido pela UART.
      lastByteMs = millis();
      if (awaitingRssi) {
        awaitingRssi = false;
        // A copia dos textos impede que a proxima recepcao sobrescreva campos do documento.
        message.clear();
        const bool valid = length > 0 && !deserializeJson(message, static_cast<const char*>(buffer), length,
                                                        DeserializationOption::NestingLimit(4));
        rssiDbm = static_cast<int>(incoming) - 255; // Formula do manual DX-LR32.
        length = 0;
        if (valid && message.is<JsonObject>()) return true;
        Serial.println("Pacote descartado: JSON invalido ou excessivo.");
        continue;
      }
      if (dropping) {
        if (incoming == '\n') { dropping = false; length = 0; awaitingRssi = true; }
        continue;
      }
      if (incoming == '\n') {
        if (length) awaitingRssi = true;
      } else if (incoming != '\r') {
        if (length == 0 && incoming != '{') continue; // Ignora mensagens de boot do modem.
        if (length < MAX_JSON_BYTES) buffer[length++] = incoming;
        else { dropping = true; length = 0; }
      }
    }
    return false;
  }

 private:
  HardwareSerial& serial; // Porta do modem.
  bool ready = false; // Nao aceita dados antes da configuracao e saida de AT confirmadas.
  char buffer[MAX_JSON_BYTES + 1]{}; // JSON recebido antes do RSSI.
  size_t length = 0; // Bytes JSON acumulados.
  bool awaitingRssi = false; // O proximo byte e RSSI, mesmo que pareca texto.
  bool dropping = false; // Descarta uma linha excessiva.
  uint32_t lastByteMs = 0; // Permite recuperar mensagens interrompidas.

  // Reinicia apenas o estado de recepcao, sem modificar o radio.
  void reset() { length = 0; awaitingRssi = false; dropping = false; }

  // Compara linhas completas: nao aceita NOTOK como OK ou DRSSI=10 como DRSSI=1.
  bool hasLine(const String& response, const char* expected) {
    String wanted(expected); // Tolera espacos inseridos pelo firmware nas respostas AT.
    wanted.replace(" ", "");
    wanted.replace("\t", "");
    String line; // Linha atual, sem CR e espacos.
    for (size_t index = 0; index <= response.length(); ++index) {
      const char value = index == response.length() ? '\n' : response[index];
      if (value == '\n') {
        if (line == wanted) return true;
        line = "";
      } else if (value != '\r' && value != ' ' && value != '\t') line += value;
    }
    return false;
  }

  // Altera apenas parametros diferentes e exige confirmacao da consulta.
  bool ensureSetting(const char* query, const char* expected, const char* setting) {
    if (command(query, expected)) return true;
    if (!command(setting, "OK")) return false;
    return command(query, expected);
  }

  // Mostra bytes nao imprimiveis em hexadecimal para diagnosticar baud, ruido e modo.
  void printResponse(const char* label, const String& response) {
    Serial.print(label); Serial.print(": ");
    if (response.isEmpty()) { Serial.println("[nenhum byte recebido do LoRa]"); return; }
    for (size_t index = 0; index < response.length(); ++index) {
      const uint8_t value = static_cast<uint8_t>(response[index]);
      if (value >= 32 && value <= 126) Serial.write(value);
      else Serial.printf("<%02X>", value);
    }
    Serial.println();
  }

  // Recolhe respostas AT por um prazo limitado; utilizado somente na inicializacao.
  String readResponse(uint32_t timeoutMs) {
    String response; // Resposta curta de configuracao do modem.
    response.reserve(512);
    const uint32_t start = millis();
    while (millis() - start < timeoutMs) {
      while (serial.available()) {
        const char incoming = serial.read();
        if (response.length() < 512) response += incoming;
      }
      delay(1);
    }
    return response;
  }

  // Envia um comando e verifica sua resposta antes de avancar.
  bool command(const char* text, const char* expected) {
    while (serial.available()) serial.read();
    serial.print(text);
    serial.print("\r\n");
    serial.flush();
    const String response = readResponse(1500);
    printResponse(text, response);
    if (hasLine(response, expected) && hasLine(response, "OK") &&
        response.indexOf("ERROR") < 0 && response.indexOf("EEROR") < 0) return true;
    Serial.print("Resposta esperada nao confirmada: "); Serial.println(text);
    return false;
  }
};

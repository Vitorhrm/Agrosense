#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include "ProvisioningSettings.h"

#if __has_include("WifiConfig.local.h")
#include "WifiConfig.local.h"
#else
#include "WifiConfig.example.h"
#endif

// Mantem a rede sem esperar pela conexao dentro do loop de recepcao LoRa.
class ReceiverWifi {
 public:
  // Inicia a interface como cliente do roteador, caso exista um SSID configurado.
  void begin(const ProvisionedWifi& wifi) {
    if (enabled_) WiFi.disconnect();
    wifi_ = wifi;
    enabled_ = wifi_.ssid[0] != '\0';
    wasConnected_ = false;
    if (!enabled_) {
      WiFi.mode(WIFI_OFF);
      Serial.println("Wi-Fi nao configurado. Configure por Bluetooth ou WifiConfig.local.h.");
      return;
    }
    WiFi.persistent(false); // Evita gravar as credenciais na memoria flash a cada tentativa.
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(false); // As tentativas sao controladas pelo intervalo abaixo.
    startConnection();
  }

  // Observa mudancas e repete a tentativa sem usar espera por conexao ou delay longo.
  void update() {
    if (!enabled_) return;
    const bool connected = WiFi.status() == WL_CONNECTED; // Estado do enlace com o roteador.
    if (connected != wasConnected_) {
      wasConnected_ = connected;
      if (connected) {
        Serial.print("Wi-Fi conectado. IP local: ");
        Serial.println(WiFi.localIP());
      } else {
        Serial.println("Wi-Fi desconectado. LoRa e Serial continuam ativos.");
        lastAttemptMs_ = millis(); // Aguarda o intervalo antes de reconectar.
      }
    }
    if (!connected && static_cast<uint32_t>(millis() - lastAttemptMs_) >=
        WIFI_RETRY_INTERVAL_MS) {
      WiFi.disconnect(); // Encerra uma tentativa anterior antes de iniciar a proxima.
      startConnection();
    }
  }

  // Disponivel para o futuro envio HTTPS; conexao ao roteador nao garante acesso a internet.
  bool isConnected() const { return enabled_ && WiFi.status() == WL_CONNECTED && WiFi.localIP() != IPAddress(0, 0, 0, 0); }

 private:
  // Solicita conexao e devolve o controle imediatamente, sem aguardar DHCP.
  void startConnection() {
    lastAttemptMs_ = millis();
    Serial.println("Wi-Fi: tentando conectar ao roteador...");
    WiFi.begin(wifi_.ssid, wifi_.password);
  }

  bool enabled_ = false; // Indica se existe configuracao de rede local.
  ProvisionedWifi wifi_{};
  bool wasConnected_ = false; // Evita repetir mensagens de estado no Monitor Serial.
  uint32_t lastAttemptMs_ = 0; // Marca a ultima tentativa; suporta a volta do millis().
};

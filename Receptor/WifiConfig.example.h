#pragma once

// Copie para WifiConfig.local.h e preencha neste arquivo local.
// O ESP32 classico usa uma rede Wi-Fi de 2,4 GHz.
constexpr char WIFI_SSID[] = ""; // Nome exato da rede, incluindo maiusculas e espacos.
constexpr char WIFI_PASSWORD[] = ""; // Senha da rede; nunca e impressa no Serial.
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 30000; // Intervalo entre tentativas de conexao.

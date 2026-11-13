# Classificacao RSSI por station

O Station envia sensores e `node`. O Access Point mede o RSSI do pacote recebido e acrescenta somente `signal` ao JSON impresso no Monitor Serial (115200 baud). Os numeros de RSSI e SNR nao vao no JSON. O Station nao calcula sinal nem aguarda ACK.

## Escala aplicada no Access Point

| RSSI interno | Campo signal |
|---|---|
| >= -60 dBm | Muito próximo |
| >= -90 e < -60 dBm | Bom |
| >= -115 e < -90 dBm | Regular |
| >= -130 e < -115 dBm | Zona de limite |
| < -130 dBm | Crítico |

As categorias descrevem somente a intensidade recebida, conforme a escala escolhida para o projeto. Nao garantem entrega de pacotes, distancia ou ajuste automatico da velocidade. Sem mensagem recebida, nao existe RSSI novo; nao se deve interpretar uma classificacao antiga como estado atual.

## Identificacao e varias stations

No inicio de Station.ino, configure `NODE_ID` com nomes unicos: `station1`, `station2` etc. Cada linha de saida do Access Point associa a classificacao ao `node` daquela coleta, sem compartilhar o RSSI de outra station. Os radios precisam usar parametros RF compativeis. Stations transmitindo juntas podem colidir; esta versao nao implementa escalonamento ou retransmissoes.

Exemplo ILUSTRATIVO da saida serial do Access Point:

```json
{"v":1,"node":"station1","seq":1,"uptime_ms":1500,"temp_c":25.4,"air_rh_pct":61.2,"pressure_hpa":931.5,"soil_raw":0,"soil_enabled":false,"signal":"Bom"}
```

O campo `signal` e criado no Access Point, depois da recepcao; nao faz parte da mensagem irradiada originalmente pela station.

## Arquivos e configuracao

- Station: Station.ino, SensorReadings.h, Aht20Reader.h e RadioLink.h.
- Access Point: AccessPoint.ino e RadioLink.h.
- RX do ESP32 = GPIO16 ligado ao TX LoRa; TX = GPIO17 ligado ao RX LoRa. GND comum.
- AHT20/BMP280: SDA21, SCL22. Solo: AO34, desativado ate `SOIL_SENSOR_ENABLED = true`.
- UART do modem: 9600 baud; Monitor Serial USB: 115200.

Na inicializacao os sketches tentam entrar em AT e confirmam modo transparente, pacote de 230 bytes e RSSI anexado (ativado no Access Point e na Station). Nao alteram canal, nivel de velocidade, chave ou baud. Essa configuracao e persistente no modem. Se um comando nao for confirmado, a aplicacao para a coleta/recepcao e informa erro na serial, evitando interpretar dados sem RSSI como medicoes reais. Confira alimentacao, UART e modo de controle M0/M1 antes de reiniciar.

Cada JSON e enviado junto com LF em uma unica escrita UART e limitado a 230 bytes no total. O Access Point espera o byte binario de RSSI apos esse pacote, inclusive se o byte tiver valor igual a LF/CR. Esse transporte pressupoe radios DX-LR32 compativeis com o manual e um pacote RF por coleta, sem prefixos adicionais. Configuracoes/firmwares diferentes exigem validacao de bancada.

Formula usada internamente, especifica do manual DX-LR32: `RSSI_dBm = byte_recebido - 255`. Exemplo: byte 0xAB (171) corresponde a -84 dBm, classificado como Bom. Nao usar formulas de outros modulos, como E220, sem conferir o manual.

## Validacao fisica pendente

Depois de gravar os dois ESP32, confirme na serial que a configuracao foi aceita e que o Access Point imprime `node` e `signal`. Aproxime/afaste os radios para verificar a variacao. Nenhum firmware foi gravado automaticamente nesta atualizacao.

Fonte: [DX-LR32-900T22D, guia UART, pagina 22](https://www.szdx-smart.com/static/upload/2025/12/11/202512112006.pdf).

Revisao: respostas AT verificadas por linha completa e OK; modo SLEEP=2 consultado/configurado; AHT20 com CRC e timeout; validacao de tipos e faixas no Access Point. Consulte os TXTs atualizados em cada pasta.

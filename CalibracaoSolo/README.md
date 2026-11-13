# Calibração do Capacitive Soil Moisture Sensor v2.0.0

O método de dois pontos é uma normalização inicial. Não existe um par universal de valores ADC para todos os sensores v2.0, solos e placas ESP32. As referências começam como **não medidas**; não foram copiados valores de exemplos da internet.

## Procedimento

1. Use o ESP32 **Station**, com AO no GPIO34, alimentação e cabos iguais aos da montagem definitiva. Este sketch substitui temporariamente o firmware de coleta nesse ESP32; não grave no Access Point.
2. Grave `CalibracaoSolo.ino`. Abra o Monitor Serial em **115200 baud**. O sketch mostra a média de 64 amostras e o mínimo/máximo a cada segundo.
3. Prepare uma amostra de referência seca do solo que será utilizado. Mantenha profundidade de inserção, compactação e posição constantes. Aguarde leituras estáveis e envie **D** para capturar a referência seca.
4. Prepare uma amostra saturada do mesmo solo, umedecida de forma uniforme e sem bolsões de ar. Documente como a saturação foi obtida. Mantenha a mesma geometria de medição, aguarde estabilizar e envie **M**.
5. Envie **P**. Copie as duas constantes exibidas para `Station/SoilCalibrationConfig.h`.
6. Grave novamente `Station/Station.ino`. O Serial da Station passa a mostrar o índice relativo de 0 a 100 junto das coletas.

Repita as medições de cada condição para verificar a repetibilidade antes de aceitar as referências. Se a amplitude do ruído for comparável à diferença entre seco e saturado, a calibração não é adequada: revise a montagem e a medição. Os comandos capturam somente um conjunto; não detectam automaticamente se o solo está seco ou saturado. As referências do sketch de calibração são temporárias e se perdem ao reiniciar.

**Não mergulhe os componentes, conector ou parte eletrônica da placa.** O teste ar/água proposto em exemplos de fabricante serve para conferir a resposta e os extremos da sonda; não substitui as referências no solo real. A marca v2.0 não confirma que o sensor seja um DFRobot SEN0193, portanto a documentação desse fabricante é referência de método, não comprovação de equivalência elétrica.

## Cálculo e interpretação

```text
indice_relativo = limitar(100 × (ADC_atual − ADC_seco) / (ADC_saturado − ADC_seco), 0, 100)
```

O cálculo aceita a polaridade observada nas referências. Valores inválidos, iguais ou ausentes desabilitam o índice. O ADC bruto permanece intacto.

**0 e 100 são os extremos escolhidos para esta montagem. Não representam porcentagem real de água no solo, umidade relativa do ar, capacidade de campo ou limites de irrigação.** Saturação e capacidade de campo são condições diferentes. Não há classificação automática seco/bom/molhado nem limiar de irrigação neste código.

O índice é mostrado **apenas no Serial da Station**. O JSON LoRa e a API continuam recebendo `soil_raw`: isso preserva o protocolo e o limite de 229 bytes do pacote existente. O Access Point e a IA continuam tratando o solo como ADC bruto. Não foi alterado o frontend experimental.

Para obter teor de água adequado a uma análise quantitativa do TCC, obtenha várias amostras com umidades conhecidas por método gravimétrico, ajuste uma curva específica para o solo/sensor e valide com amostras independentes. Conversão gravimétrica para volumétrica também exige densidade aparente. A normalização de dois pontos não substitui essa etapa.

## Referências consultadas

- [DFRobot: sensor capacitivo e calibração](https://wiki.dfrobot.com/sen0193): demonstra referências ar/água e substituição dos valores por medições próprias.
- [DFRobot: exemplo e influência da profundidade/compactação](https://wiki.dfrobot.com/sen0193/docs/18036).
- [Performance of Two Low-Cost Capacitive Soil Moisture Sensors Under Contrasting Texture and Salinity Conditions](https://www.mdpi.com/2073-4441/18/12/1431): aponta limitações de ar/água e necessidade de referências específicas do meio.
- [Espressif: ADC Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html): resolução de 12 bits e configuração de atenuação. A calibração elétrica do ADC não é a calibração da umidade do solo.

## Calibração no aplicativo

Em **Áreas e culturas → Estações**, informe as médias seca e saturada em ADC e salve. O aplicativo usa os dois pontos para calcular um índice relativo na escala 0–100, preservando o ADC na tela de telemetria. A alteração no app não exige regravar o firmware de coleta. Para obter os pontos, meça na própria montagem com solo seco e saturado, na mesma profundidade e compactação. Repita as capturas e compare a variação com a distância entre as médias.

A literatura encontrou diferenças entre os resultados de sondas capacitivas v2.0 em oito solos. Os números publicados dependem da montagem e não devem ser copiados para a escala do GPIO34. Para estimar teor volumétrico, colete vários pares de ADC e teor de água de referência no solo usado e valide a curva. [Estudo com sondas v2.0 e oito solos](https://doi.org/10.3390/s26113291) · [Método de referência da DFRobot](https://wiki.dfrobot.com/sen0193/docs/18036).

### Valores publicados para comparar na bancada

Um projeto com a inscrição exata **v2.0.0**, ESP32-C6 e alimentação 3,3 V mediu cerca de **2600 ADC no ar** e **930 ADC na água**. Use esse par para ensaiar a conversão ou conferir se a leitura muda no sentido esperado. A placa, o pino e o meio são diferentes do ensaio em solo com GPIO34. [Projeto que publicou as leituras](https://github.com/pyxploiter/esp32-soil-monitor#-sensor-calibration).

Um estudo com sondas v2.0 encontrou resposta não linear e perda de sensibilidade em condições muito úmidas. Os autores ajustaram curvas para oito solos na escala do próprio equipamento. Para estimar teor volumétrico, repita esse método no seu solo com vários pontos de referência e valide a faixa útil. [Strypsteen et al., 2026](https://doi.org/10.3390/s26113291).

Com a estação já coletando, use **Telemetria** para anotar várias leituras ADC em cada condição e salve as médias em **Áreas e culturas → Estações**. Para gravar o índice no pacote LoRa, preencha as mesmas referências em `Station/SoilCalibrationConfig.h` quando for regravar a Station.

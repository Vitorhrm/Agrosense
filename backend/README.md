# AgroSense Lab: API e painel

> **Escopo:** a API recebe e persiste a telemetria do projeto. O frontend em `public/` é apenas um painel de teste; o aplicativo principal fica em [`../APP`](../APP/README.md). Os testes deste painel não significam que o aplicativo principal já consome as leituras reais.

Painel publicado: https://agrosense-lab-vitor-f35a.vercel.app

Recebe JSON do receptor ESP32 por HTTPS, armazena no Supabase e mostra as medições por estação. O botão **Gerar resumo** chama NVIDIA Build com `nvidia/nemotron-3.5-bolt-e4b`. Este painel é separado do aplicativo web/Android em `../APP`, cuja integração com esta API ainda está pendente.

## Fluxo e organização

Estação e sensores → LoRa → receptor (classifica RSSI) → HTTPS → API Vercel → Supabase. O navegador consulta a API com sessão autenticada; a NVIDIA só é chamada quando o usuário solicita um resumo.

- `api/index.js`: entrada da Function Vercel.
- `lib/`: validação, autenticação, banco e chamada da IA.
- `public/`: HTML, CSS e JavaScript; gráfico Canvas sem CDN.
- `supabase/schema.sql`: criação inicial do banco em projeto vazio.
- `scripts/dev.js`: servidor local.
- `test/`: testes de autenticação, validação, deduplicação e resumo.

## Executar e publicar

Requer Node.js 24 e npm. Execute `npm ci`, copie `.env.example` para `.env.local`, preencha a configuração e execute `npm run dev`. Abra http://localhost:3000. Verificações: `npm test` e `npm run check`.

Aplique o esquema SQL uma única vez em um banco novo. Não reaplique sobre tabelas existentes. O projeto Supabase **AgroSense**, em São Paulo, é separado do projeto de autenticação do aplicativo original.

Na Vercel, publique esta pasta como raiz do projeto, framework **Other**, saída `public`, Node.js 24. `vercel.json` encaminha `/api/*` para a Function.

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `SUPABASE_URL` | URL do projeto AgroSense |
| `SUPABASE_SECRET_KEY` | Chave secreta Supabase, somente no servidor |
| `NVIDIA_API_KEY` | Chave NVIDIA Build, somente no servidor |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-bolt-e4b` |
| `INGEST_TOKEN` | Token aleatório de pelo menos 32 caracteres, compartilhado apenas com o receptor |
| `DASHBOARD_PASSWORD` | Senha do painel, pelo menos 16 caracteres |
| `SESSION_SECRET` | Segredo aleatório de pelo menos 32 caracteres para assinar sessões |

Use o tipo **Secret** para credenciais. A configuração inicial está em **Production**; previews precisam de configuração própria. Nenhuma chave é entregue ao navegador.

### Trocar a chave NVIDIA

1. Abra [Environment Variables](https://vercel.com/vitor-f35a/agrosense-lab/settings/environment-variables).
2. Edite `NVIDIA_API_KEY`, informe a nova chave e salve em **Production**.
3. Abra **Deployments**, selecione a publicação mais recente e clique em **Redeploy**.
4. No painel, gere um resumo quando houver novas coletas. Se não houver dados novos, o resumo existente é reutilizado.

Também é possível trocar `NVIDIA_MODEL` e `DASHBOARD_PASSWORD`. Ao mudar a senha, troque `SESSION_SECRET` para invalidar todas as sessões anteriores. Cada sessão dura 24 horas.

## Configurar o receptor

1. Abra `../Receptor/Receptor.ino` no Arduino IDE.
2. Copie `WifiConfig.example.h` para `WifiConfig.local.h` e preencha `WIFI_SSID` e `WIFI_PASSWORD` com uma rede de **2,4 GHz**.
3. Copie `CloudConfig.example.h` para `CloudConfig.local.h`; configure a URL terminada em `/api/readings` e o mesmo `INGEST_TOKEN` da Vercel. O token já foi preenchido na configuração local inicial.
4. Grave no receptor (COM5 na montagem atual). Monitor Serial: **115200 baud**.

Os arquivos `.local.h` e `.env.local` são ignorados pelo Git. Nunca coloque chave NVIDIA ou Supabase no ESP32. O transmissor não precisa de internet. Sem Wi-Fi configurado, LoRa e Serial continuam funcionando.

O receptor sincroniza a hora por NTP e valida certificados HTTPS usando as autoridades do core ESP32. A fila em RAM guarda 12 coletas, além da coleta em processamento. Quando cheia, novas coletas ficam apenas no Serial. Um reinício perde a fila. Há até três tentativas por coleta, com o mesmo UUID; erros permanentes 4xx são descartados. Não há histórico offline em flash. Uma conexão Wi-Fi não comprova acesso à internet: a confirmação é a mensagem **Nuvem: coleta entregue.**

## API

| Método e rota | Acesso | Resultado |
| --- | --- | --- |
| `GET /api/health` | Público | Verificação básica da API; não testa banco/IA |
| `POST /api/login` | Senha do painel | Cookie HttpOnly, SameSite=Strict, Secure em HTTPS |
| `POST /api/logout` | Navegador | Encerra sessão local |
| `POST /api/readings` | `Authorization: Bearer INGEST_TOKEN` | Persiste coleta |
| `GET /api/stations` | Cookie | Última coleta por estação |
| `GET /api/readings?node=station1&hours=1` | Cookie | Histórico e resumo; períodos 1, 6 ou 24 horas |
| `POST /api/summary` | Cookie | Corpo `{"node":"station1"}`; gera ou reutiliza resumo |

Exemplo ilustrativo de ingestão, sem representar coleta real:

```json
{"v":1,"node":"station1","seq":2,"uptime_ms":27932,"temp_c":23.62,"air_rh_pct":66.38,"pressure_hpa":900.78,"soil_raw":3282,"soil_enabled":true,"signal":"Muito próximo","event_id":"850bd287-d82c-4318-9df3-cec621ddceba"}
```

O receptor gera `event_id` UUID v4 e o preserva nas retentativas. Novas coletas retornam 201; duplicatas retornam 200. A data exibida é a de recebimento no servidor, não a de aquisição no campo. `seq` e `uptime_ms` não são identificadores globais.

## Banco, IA e limites

As tabelas `agro_readings`, `agro_summaries` e `agro_summary_limits` usam RLS e não concedem acesso a `anon`/`authenticated`. Somente a API usa a chave secreta. Views e funções são `security invoker`. O gráfico agrega aproximadamente 360 pontos por período.

A IA usa estatísticas das últimas 120 coletas da estação selecionada, com intervalo mínimo de um minuto entre solicitações. Não há chamada automática a cada coleta de dez segundos. Erros da NVIDIA aparecem no painel sem inventar um resumo substituto. Não há limpeza automática do histórico; planeje retenção e quotas antes de uso prolongado.

`soil_raw` é ADC de 0 a 4095, **não percentual de umidade**. Sem calibração, não permite afirmar solo seco/molhado ou decidir irrigação. O sinal é a categoria RSSI do receptor, não Wi-Fi, SNR ou distância. O painel marca coleta antiga após 60 segundos sem atualização; ajuste se mudar o intervalo do transmissor.

Acesso por senha única atende ao teste pessoal. Ainda faltam contas individuais, associação entre usuário/área/estação, provisionamento e limitação de login por IP. O protótipo não aciona bombas ou válvulas.

## Validação realizada em 05/11/2026

Cinco testes automatizados passaram. Firmware do receptor compilado e gravado na COM5 com o core ESP32 3.3.12. Conexão ao Wi-Fi confirmada; coletas reais de station1 chegaram por LoRa, foram enviadas por HTTPS e apareceram no Supabase e no gráfico. A chamada NVIDIA com Nemotron retornou resumo com sucesso. Os registros artificiais de teste foram removidos; o painel acompanha as coletas reais.

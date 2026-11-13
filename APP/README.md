# AgroSense

> **TCC em desenvolvimento** · Bacharelado em Sistemas de Informação, IFMG.

O projeto investiga como dados meteorológicos e medições de uma estação ESP32 com sensores de solo podem apoiar decisões de irrigação. Esta pasta contém o aplicativo principal do protótipo; o repositório completo também inclui os firmwares e a API, descritos no [README geral](../README.md).

O painel em `../backend/public` foi criado somente para testar a telemetria e a IA. Ele não substitui este aplicativo. A coleta física, o envio LoRa e o encaminhamento Wi-Fi/HTTPS foram validados em bancada em 05/11/2026; a tela Telemetria consulta as leituras autorizadas no novo banco. A validação física no novo ambiente deve ser repetida.

| Área | Estado atual |
| --- | --- |
| Aplicativo | Interface React/TypeScript para web e Android e autenticação por e-mail via Supabase |
| Monitoramento agrícola | Telemetria real e telas de exemplo identificadas |
| Integrações | Supabase, Vercel, Open-Meteo e BLE no Android |

Aplicativo acadêmico de monitoramento agrícola e apoio à irrigação, com interface em **React e TypeScript** e autenticação pelo **Supabase**. A mesma interface pode ser executada no navegador ou empacotada como aplicativo Android.

## Tecnologias

- React 19 e TypeScript para a interface e a lógica do aplicativo.
- Vite 8 para desenvolvimento e geração dos arquivos de produção.
- Supabase JS para cadastro, login e gerenciamento da sessão.
- CSS organizado junto de cada tela e componente.
- Vitest e Testing Library para testes automatizados; ESLint para análise estática.
- Android WebView e uma Activity mínima em Kotlin para abrir a interface, ajustar a janela e tratar o botão Voltar.

A autenticação e as regras do frontend ficam em TypeScript. O Kotlin está restrito à integração com o Android.

## Funcionalidades e estado atual

A autenticação implementa cadastro com nome e sobrenome, login por e-mail e senha, restauração e renovação de sessão, logout no dispositivo atual e proteção das telas privadas. Quando o Supabase exige confirmação de e-mail, o cadastro apresenta a orientação correspondente e aguarda uma sessão válida.

Na página inicial, **Telemetria** mostra as coletas reais das estações autorizadas e **Áreas e culturas** cadastra áreas e parâmetros no banco, vincula estações e consulta previsão por coordenadas. As demais telas com dados de exemplo são identificadas como demonstração.

Recuperação de senha, login social, integração com sensores e persistência dos dados agrícolas ainda não estão implementados.

## Configurar dispositivos no Android

1. Entre na conta e abra **Configurar dispositivos**.
2. Reinicie o ESP32. Ele anuncia `AgroSense-Station` ou `AgroSense-AccessPoint` até concluir o primeiro cadastro. Em reinícios de dispositivos já configurados, a janela é de cinco minutos. Leia o PIN na serial USB a 115200 baud.
3. Escolha o tipo, permita a busca Bluetooth e selecione o dispositivo. Digite o PIN no diálogo do Android.
4. Comece pelo Access Point. Defina o nome da rede LoRa (SSID) e a senha. O Access Point pode ficar geral ou vinculado a uma área. Toque em **Buscar redes Wi-Fi**, selecione a rede e digite a senha. Se a conexão falhar, o app avisa e mantém o Bluetooth disponível para corrigir. Se conectar e receber IP, o Access Point salva as configurações e encerra o Bluetooth após a confirmação.
5. Conecte à Station. Toque em **Buscar redes LoRa**, escolha a rede do Access Point e digite a senha LoRa. Se for o primeiro cadastro, use o código de ativação da estação para liberar a telemetria na sua conta e escolha a área.
6. Aguarde a confirmação do ESP32. Se o cadastro no banco falhar, repita apenas essa etapa pelo app. Reconecte para conferir o estado da rede. Para editar depois, reinicie o ESP32 e refaça a conexão.

O Wi-Fi é configurado por BLE com pareamento autenticado e a senha fica no Access Point. O Supabase recebe os metadados e o vínculo da área. A descoberta e o pareamento LoRa ocorrem entre os ESP32 no canal já configurado. Os dois rádios precisam usar parâmetros RF compatíveis. Use uma senha LoRa forte de 16 a 64 bytes. Atualize os dois firmwares antes de habilitar a rede protegida. Depois de alterar o SSID ou a senha no Access Point, refaça o pareamento da Station. Na bancada, verifique se o Access Point aparece na busca, se uma senha incorreta é rejeitada, se a senha correta confirma o vínculo e se a telemetria continua após reiniciar os dois ESP32.

No navegador, use o mesmo login, áreas, culturas, previsão e telemetria. O provisionamento usa o Bluetooth nativo do Android.

## Organização do projeto

```text
Agrosense/
├── frontend/
│   ├── src/
│   │   ├── app/              Composição da aplicação e proteção das telas
│   │   ├── screens/          Telas, cada uma com TSX e CSS na mesma pasta
│   │   ├── components/       Componentes reutilizáveis e seus estilos
│   │   ├── features/auth/    Serviço, tipos, mensagens e testes de autenticação
│   │   ├── lib/              Cliente compartilhado do Supabase
│   │   ├── data/             Dados agrícolas de demonstração
│   │   ├── styles/           Fontes, cores e estilos compartilhados
│   │   ├── fonts/            Fontes locais da interface
│   │   └── types/            Tipos compartilhados
│   ├── tests/                Configuração dos testes de interface
│   ├── .env.example          Modelo da configuração pública do Supabase
│   └── package.json          Dependências e comandos do frontend
├── app/src/main/
│   ├── java/com/example/agrosense/MainActivity.kt
│   ├── assets/agrosense/     Interface gerada pelo build Android
│   └── res/                  Recursos nativos do Android
├── scripts/build-frontend.mjs
└── gradle/                   Configuração da compilação Android
```

Para alterar uma tela, procure sua pasta em `frontend/src/screens`: o componente e seu CSS ficam juntos. Componentes utilizados em mais de uma tela ficam em `components`; estilos realmente compartilhados ficam em `styles/shared.css`.

A organização busca responsabilidades claras e reaproveitamento quando necessário (DRY), sem criar abstrações para toda pequena semelhança (WET). Comentários explicam decisões que ajudam a manutenção.

## Requisitos

- Node.js 22.12 ou superior, com npm.
- Um projeto Supabase com autenticação por e-mail habilitada.
- Para Android: Android Studio, SDK Android 37 e JDK compatível com o Gradle do projeto; prefira o JDK incluído no Android Studio.
- Aparelho com Android 7.0/API 24 ou superior, ou emulador Android configurado.

## Instalação e configuração

Clone o repositório e instale as dependências:

```sh
git clone https://github.com/Vitorhrm/Agrosense.git
cd Agrosense/APP/frontend
npm ci
```

Copie `frontend/.env.example` para `frontend/.env.local`. No PowerShell, dentro de `frontend`:

```powershell
Copy-Item .env.example .env.local
```

Preencha o arquivo com os dados públicos do seu projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publica
```

O arquivo `.env.local` e o `local.properties` não são enviados ao Git. As variáveis `VITE_` são incorporadas ao frontend compilado e são públicas: use somente a chave **publishable**, nunca `service_role`, `sb_secret_`, senha do banco ou credenciais administrativas.

Defina também `VITE_AGROSENSE_API_URL` para a origem HTTPS da API da previsão. Depois de alterar a configuração, reinicie o servidor de desenvolvimento ou recompile o APK. A exigência de confirmação de e-mail depende da configuração do seu projeto Supabase; o aplicativo trata os dois casos.

## Executar no navegador

Dentro de `frontend`:

```sh
npm run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173). A porta é fixa; encerre outro processo que a esteja usando antes de iniciar o servidor.

Para gerar e conferir a versão de produção:

```sh
npm run build
npm run preview
```

O build web é gerado em `frontend/dist`. O comando de prévia informa sua própria URL no terminal.

## Executar no Android

1. Instale as dependências e configure o Supabase conforme as instruções anteriores.
2. Abra a pasta **APP** no Android Studio e sincronize o Gradle.
3. Selecione um aparelho ou emulador e clique em **Run**.

O Gradle executa `scripts/build-frontend.mjs`, verifica o TypeScript e gera os assets React antes de empacotar o aplicativo. Não edite manualmente `app/src/main/assets/agrosense`.

Para compilar e analisar pelo PowerShell, na pasta `APP`:

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

O APK fica em `app/build/outputs/apk/debug/app-debug.apk`.

Se o Android Studio não encontrar o Node.js, adicione o caminho local em `local.properties`, preservando a configuração `sdk.dir` criada pelo Android Studio:

```properties
NODE_BINARY=C:/caminho/para/node.exe
```

O nome exibido é **AgroSense** e o identificador Android é `com.example.agrosense`. A instalação é separada do antigo `com.example.irri` e não migra sua sessão.

## Comandos e testes

Execute estes comandos dentro de `frontend`:

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Iniciar o frontend em desenvolvimento |
| `npm run typecheck` | Verificar os tipos do TypeScript |
| `npm run lint` | Verificar o código com ESLint |
| `npm test` | Executar os testes automatizados |
| `npm run test:watch` | Reexecutar testes durante o desenvolvimento |
| `npm run build` | Verificar tipos e gerar o build web |
| `npm run preview` | Servir o build web para conferência |
| `npm run build:android` | Verificar tipos e gerar os assets do APK |
| `npm run format` | Formatar o código |

A suíte cobre autenticação, sessão, áreas demonstrativas, telemetria, calibração e cadastro Bluetooth com dispositivo simulado.

Para uma validação manual completa, teste também cadastro e login no seu projeto Supabase, reabertura do aplicativo com sessão ativa, saída da conta e comportamento sem conexão. Testes automatizados e compilação não substituem essa conferência no navegador e no Android.

## Cuidados de manutenção

- Mantenha `package-lock.json` versionado e use `npm ci` para instalações reproduzíveis.
- Centralize chamadas de autenticação em `features/auth/auth.service.ts` e reutilize o cliente de `lib/supabase.ts`.
- O SDK gerencia persistência e renovação dos tokens; não armazene senhas nem replique essa lógica nas telas.
- A proteção das telas controla a navegação. Ao integrar dados reais, configure RLS e políticas de autorização no Supabase.
- Ao adicionar funcionalidades, atualize os testes de comportamento e a documentação.
- Para implementar recuperação de senha, configure a URL de retorno e o fluxo de recuperação, incluindo links profundos no Android.

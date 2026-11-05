# AgroSense

> **TCC em desenvolvimento** · Bacharelado em Sistemas de Informação, IFMG.

O projeto investiga como dados meteorológicos e medições de uma estação ESP32 com sensores de solo podem apoiar decisões de irrigação. Este repositório apresenta o aplicativo do protótipo.

| Área | Estado atual |
| --- | --- |
| Aplicativo | Interface React/TypeScript para web e Android e autenticação por e-mail via Supabase |
| Monitoramento agrícola | Telas com dados demonstrativos |
| Integrações em desenvolvimento | Estação ESP32, dados meteorológicos reais, provisionamento de dispositivos e persistência de medições |

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

A interface inclui início, áreas de cultivo, estações, clima, alertas, perfil, parâmetros de culturas e histórico. **Os dados agrícolas são de demonstração**, identificados na interface; ainda não são leituras de sensores nem registros persistidos no Supabase. Os formulários agrícolas e controles do protótipo não representam uma integração completa com o banco.

Recuperação de senha, login social, integração com sensores e persistência dos dados agrícolas ainda não estão implementados.

## Cadastro de dispositivos (prévia)

Dentro de cada área, o botão **Cadastrar dispositivo** abre duas opções:

- **Cadastrar transmissor:** seleção de um ESP32 de exemplo por Bluetooth, preenchimento do SSID e senha do Wi-Fi e do identificador da rede LoRa.
- **Cadastrar estação:** seleção de um ESP32 de exemplo por Bluetooth, definição do nome e escolha de um transmissor LoRa em uma lista simulada, com RSSI em dBm.

O fluxo representa a futura comunicação: o celular conecta ao ESP32 por Bluetooth; no cadastro da estação, o próprio ESP32 faz o scan LoRa e devolve os resultados ao celular. RSSI é intensidade do sinal, enquanto o identificador LoRa distingue o transmissor/rede.

**Esta etapa é somente uma prévia de interface.** Não solicita permissões Bluetooth, não descobre dispositivos reais, não envia configurações ao ESP32 e não salva cadastros no Supabase. Use dados fictícios. A senha permanece apenas no estado temporário do formulário e é descartada ao concluir, cancelar ou voltar à busca.

O componente e seus estilos ficam em `frontend/src/features/devices/DeviceRegistration`; os dispositivos fictícios ficam em `provisioning.demo.ts`. A seleção de área é mantida durante a navegação para que o cadastro indique a área correta.

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
cd Agrosense/frontend
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

Depois de alterar a configuração, reinicie o servidor de desenvolvimento ou recompile o APK. A exigência de confirmação de e-mail depende da configuração do seu projeto Supabase; o aplicativo trata os dois casos.

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
2. Abra a **raiz do repositório** no Android Studio e sincronize o Gradle.
3. Selecione um aparelho ou emulador e clique em **Run**.

O Gradle executa `scripts/build-frontend.mjs`, verifica o TypeScript e gera os assets React antes de empacotar o aplicativo. Não edite manualmente `app/src/main/assets/agrosense`.

Para compilar e analisar pelo PowerShell, na raiz do repositório:

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

A suíte atual contém 18 testes que cobrem formulários, validação, erros de autenticação, bloqueio de acesso por hash, restauração e expiração da sessão, logout e comunicação com o SDK. Também verificam as opções de dispositivos, os formulários de transmissor/estação, a seleção LoRa e o contexto da área. As respostas do Supabase são simuladas nesses testes; eles não criam contas nem enviam e-mails reais.

Para uma validação manual completa, teste também cadastro e login no seu projeto Supabase, reabertura do aplicativo com sessão ativa, saída da conta e comportamento sem conexão. Testes automatizados e compilação não substituem essa conferência no navegador e no Android.

## Cuidados de manutenção

- Mantenha `package-lock.json` versionado e use `npm ci` para instalações reproduzíveis.
- Centralize chamadas de autenticação em `features/auth/auth.service.ts` e reutilize o cliente de `lib/supabase.ts`.
- O SDK gerencia persistência e renovação dos tokens; não armazene senhas nem replique essa lógica nas telas.
- A proteção das telas controla a navegação. Ao integrar dados reais, configure RLS e políticas de autorização no Supabase.
- Ao adicionar funcionalidades, atualize os testes de comportamento e a documentação.
- Para implementar recuperação de senha, configure a URL de retorno e o fluxo de recuperação, incluindo links profundos no Android.

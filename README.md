# AgroSense

Aplicativo acadêmico de monitoramento agrícola: **React + TypeScript**, executado no navegador e em uma WebView Android. O Kotlin se limita à `MainActivity`, responsável pela janela, pelos assets locais e pelo botão Voltar. Não há autenticação, tokens ou regras de negócio em Kotlin.

## Estrutura

```text
frontend/
  src/
    app/                 composição da aplicação e proteção das telas
    screens/             uma pasta por tela, com TSX e CSS adjacentes
    components/          componentes reutilizáveis, com seu CSS
    features/auth/       serviço, tipos, mensagens e testes da autenticação
    lib/supabase.ts      instância única do cliente oficial
    data/demo.ts         dados agrícolas fictícios, identificados na interface
    styles/shared.css    fontes, cores, base e estilos realmente compartilhados
    types/               tipos de navegação e ícones
  tests/                 configuração dos testes de interface
scripts/build-frontend.mjs
app/src/main/java/com/example/agrosense/MainActivity.kt
```

Procure primeiro a tela em `screens`. Seu estilo fica no mesmo diretório. Extraia componentes quando houver reutilização ou uma responsabilidade clara; não transforme trechos pequenos e distintos em abstrações difíceis de acompanhar. Duplicação pontual é preferível a acoplar telas sem necessidade (WET); padrões compartilhados ficam em `components` e `styles` (DRY). Comentários explicam decisões e limites, em vez de repetir o código.

## Executar no navegador

Requisitos: Node.js 22.12+ com npm. Na pasta do projeto:

```sh
cd frontend
npm ci
npm run dev
```

Abra a URL indicada pelo Vite (normalmente `http://127.0.0.1:5173`). Para gerar e conferir a versão de produção: `npm run build` e `npm run preview`.

## Supabase

A configuração deste computador já está em `frontend/.env.local`, ignorado pelo Git. Em outro computador, copie `.env.example` para `.env.local` e preencha a URL e a chave **publishable** do seu projeto. Reinicie o Vite ou recompile o APK depois de alterar o arquivo. Variáveis `VITE_` são públicas no aplicativo compilado: nunca use `service_role`, `sb_secret_`, senha do banco ou tokens administrativos aqui.

O serviço oficial implementa:

- login por e-mail e senha;
- cadastro com nome e sobrenome em `user_metadata.first_name/last_name`;
- resposta de confirmação de e-mail quando exigida pelo provedor;
- persistência e renovação de sessão pelo SDK;
- atualização da UI quando a sessão é encerrada ou renovada;
- logout somente no dispositivo atual;
- bloqueio de telas privadas enquanto não existe sessão.

O projeto Supabase conectado está com e-mail habilitado, cadastro permitido e confirmação automática de e-mail habilitada, conforme consulta em 22/10/2026. Nenhuma configuração remota foi alterada. O código também trata cadastro sem sessão, caso a confirmação passe a ser exigida.

O SDK mantém a sessão no armazenamento da origem WebView/navegador. Não se armazenam senhas no código, nem se implementa manualmente renovação de tokens. As telas protegidas organizam a navegação; autorização de dados reais exige RLS e políticas no Supabase. Os dados agrícolas ainda são de demonstração, sem persistência no banco.

O antigo botão “Esqueci minha senha” não executava ação e foi removido. Recuperação/alteração de senha requer uma URL de retorno válida e o fluxo correspondente, incluindo links profundos no Android; esse fluxo não foi implementado nesta entrega. Não há login social configurado.

## Executar no Android

Abra a raiz `Agrosense` no Android Studio e sincronize o Gradle. Execute `npm ci` em `frontend` uma vez; depois o botão Run verifica TypeScript e gera os assets automaticamente antes de empacotar o APK. A configuração antiga apontava para um script inexistente; agora usa `scripts/build-frontend.mjs`.

```sh
gradlew.bat :app:assembleDebug :app:lintDebug
```

Use o JDK do Android Studio. O Gradle procura `node` no PATH; se necessário, defina `NODE_BINARY=C:/caminho/node.exe` no `local.properties`. Este computador já tem essa configuração local. O pacote Android é `com.example.agrosense`; o nome visível e o nome do projeto são **AgroSense**. Por mudar o identificador antigo `com.example.irri`, a instalação é um aplicativo separado e não migra a sessão do Irri.

A WebView carrega somente assets da origem HTTPS local e bloqueia navegação externa. Chamadas HTTPS ao Supabase são feitas pelo SDK no TypeScript. O layout aplica margens das barras do sistema e do teclado; o contêiner é intencional.

## Verificação

```sh
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
npm run build:android
```

Testes verificam comportamento dos formulários, erros, validação, proteção por hash, expiração, restauração, logout e contrato com o SDK. São testes com respostas controladas; não criam contas nem enviam e-mails reais. Os 14 testes passaram. TypeScript e ESLint passaram. O APK de debug e o lint Android passaram, com zero erros e seis avisos: cinco versões de bibliotecas Android com atualização disponível e uma sugestão de layout que não se aplica ao contêiner usado para insets.

Conexão real verificada: `/auth/v1/settings` respondeu HTTP 200 com a chave pública; uma tentativa controlada com credenciais fictícias respondeu HTTP 400 `invalid_credentials`. Isso confirma que a autenticação alcança o projeto correto, mas não substitui um login real com uma conta válida.

Limitações da execução nesta sessão: o emulador padrão não iniciou por indisponibilidade de aceleração por hardware; a tentativa com emulação por software não chegou a disponibilizar dispositivo ADB. O ambiente de automação também bloqueou conexões locais com `EACCES`, impedindo a inspeção visual no navegador. Não foi possível confirmar a execução em aparelho/emulador nem realizar login real com sucesso. Nenhuma configuração de segurança do Windows foi alterada.

## Manutenção

Use `npm run format` para formatar. Mantenha `package-lock.json` e instale com `npm ci`; o lockfile antigo do pnpm foi removido. Adicione testes para mudanças de comportamento relevantes. Ao trocar a configuração pública do Supabase, refaça o build web/Android. A pasta de assets é gerada e não deve ser editada manualmente.

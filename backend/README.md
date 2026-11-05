# Backend do AgroSense

Esta pasta faz parte do repositório completo do TCC e reserva o espaço para o futuro serviço de integração do AgroSense.

**Estado atual: não implementado.** Ainda não há servidor próprio, endpoints, dependências de execução, migrações ou esquema agrícola versionado nesta pasta. O aplicativo já utiliza Supabase Auth; essa integração está em `../APP/frontend` e não constitui uma API de ingestão das coletas.

## Responsabilidades previstas

- Receber coletas encaminhadas pelo ESP32 receptor.
- Validar e persistir dados de temperatura, umidade, pressão e solo.
- Associar usuário, área, receptor e estação.
- Registrar horário de recebimento e tratar reinícios/duplicatas das stations.
- Disponibilizar as consultas utilizadas pelo aplicativo.
- Aplicar autenticação e autorização a dispositivos e usuários.

Tecnologia, banco e forma de ingestão serão definidos na implementação. Não há um comando de inicialização nem endereço de API disponíveis nesta etapa.

## Contrato de origem

O transmissor envia JSON identificado por `node`; o receptor acrescenta `signal` à saída serial. O protocolo atual, as unidades e suas limitações estão no [README geral](../README.md#protocolo-de-dados). A saída USB ainda não é enviada automaticamente à rede.

Ao implementar esta camada, documente os requisitos, as variáveis de ambiente, os endpoints, o esquema dos dados, a autorização e os testes. Mantenha apenas modelos de configuração com valores fictícios no Git.

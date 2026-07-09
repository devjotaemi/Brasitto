# Espetaria

## Descricao

Espetaria e um aplicativo para um restaurante especializado em espetos, com foco em pedidos para delivery e retirada.

O sistema tera duas interfaces principais no futuro:

- Interface do cliente para visualizar o cardapio, montar pedidos e enviar ao estabelecimento.
- Dashboard administrativo para acompanhar pedidos recebidos e atualizar seus status.

Nesta primeira etapa, o projeto deve conter apenas regras do projeto e testes unitarios da logica de dominio.

## Objetivo do aplicativo

Permitir que clientes montem pedidos de espetos com clareza de subtotal, taxa de entrega e total final, e permitir que o estabelecimento gerencie esses pedidos de forma simples.

## Regras de negocio

### Produtos

- Cada espeto deve ter nome, descricao, preco e status ativo/inativo.
- Apenas produtos ativos podem ser adicionados ao pedido.
- O preco deve ser sempre maior que zero.

### Carrinho

- Cliente pode adicionar um ou mais espetos ao carrinho.
- Cada item possui produto, quantidade e preco unitario.
- A quantidade deve ser maior que zero.
- O subtotal e a soma de preco unitario vezes quantidade.

### Pedido

- Pedido pode ser do tipo `ENTREGA` ou `RETIRADA`.
- Pedido de entrega deve ter endereco obrigatorio.
- Pedido de retirada nao deve exigir endereco.
- Pedido deve ter nome e telefone do cliente.
- Pedido deve iniciar com status `PENDENTE`.
- Pedido nao pode ser criado sem itens.
- O total do pedido deve ser o subtotal dos itens mais a taxa de entrega, quando houver.
- Se for retirada, a taxa de entrega deve ser zero.

### Taxa de entrega

- A taxa de entrega deve ser aplicada apenas em pedidos do tipo `ENTREGA`.
- Para o MVP, a taxa de entrega sera fixa em R$ 8,00.
- Futuramente a taxa podera variar por bairro ou distancia.

### Status do pedido

- `PENDENTE`
- `ACEITO`
- `EM_PREPARO`
- `SAIU_PARA_ENTREGA`
- `PRONTO_PARA_RETIRADA`
- `FINALIZADO`
- `CANCELADO`

## Arquitetura basica

O dominio deve ficar isolado de UI, banco de dados e infraestrutura.

Estrutura planejada:

```text
project
|
|- src
|  |- domain
|  |  |- product
|  |  |- cart
|  |  `- order
|  |
|  |- application
|  |  |- create-order
|  |  |- calculate-order-total
|  |  `- update-order-status
|  |
|  |- infrastructure
|  |  |- supabase
|  |  `- repositories
|  |
|  `- ui
|     |- customer
|     `- admin
|
|- tests
|  |- domain
|  `- application
```

## Decisoes tecnicas

- O dominio deve conter entidades, regras e validacoes puras.
- O dominio nao pode importar React, Supabase, APIs HTTP, componentes de UI ou detalhes de banco.
- Casos de uso devem depender de interfaces/repositorios, nao diretamente do Supabase.
- A camada de infraestrutura sera responsavel por adaptar Supabase PostgreSQL ao restante da aplicacao.
- Testes de dominio nao devem conectar ao banco de dados.
- Testes de aplicacao devem usar mocks ou fakes quando houver dependencia externa.

## Stack escolhida

- Frontend: React, TypeScript e Vite.
- Estilo: TailwindCSS.
- Testes: Vitest.
- Banco de dados: Supabase PostgreSQL.
- Deploy: Vercel.

## Fluxo XP/TDD

O desenvolvimento deve seguir este fluxo:

```text
IDEIA
->
REGRAS DO PROJETO
->
TESTES
->
IMPLEMENTACAO MINIMA
->
TESTES PASSAM
->
REFATORACAO
->
NOVA FEATURE
->
DEPLOY
```

Regras praticas:

- Criar testes antes da implementacao.
- Implementar apenas o minimo necessario para fazer o teste passar.
- Refatorar apenas depois dos testes passarem.
- Manter codigo simples, modular e facil de entender.
- Explicar decisoes de arquitetura durante o desenvolvimento.
- Evitar complexidade desnecessaria.

## Regras importantes do projeto

- Trabalhar diretamente em `master`, conforme preferencia atual do projeto.
- Pedir autorizacao antes de alterar codigo quando a mudanca nao estiver previamente aprovada.
- Commits estao autorizados ao finalizar alteracoes aprovadas.
- Manter o dominio independente de UI, banco de dados e infraestrutura.
- Casos de uso devem depender de interfaces/repositorios, nao diretamente do Supabase.
- Testes de dominio e aplicacao nao devem conectar no banco real.
- Interface, Supabase, banco e deploy ja fazem parte do MVP atual; novas mudancas devem preservar a separacao entre camadas.
- Preferir nomes explicitos e comportamentos testados.
- Evitar frameworks ou dependencias dentro do dominio.

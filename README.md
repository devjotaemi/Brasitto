# Quinta da Torta

Aplicativo para um restaurante especializado em tortas por delivery e retirada.

## Stack

- React
- TypeScript
- Vite
- Vitest
- Supabase PostgreSQL
- Vercel

## Arquitetura

```text
src/domain
src/application
src/infrastructure
src/ui
```

Regras principais:

- Dominio nao importa UI, Supabase ou infraestrutura.
- Casos de uso dependem de interfaces em `src/application/repositories`.
- Supabase fica apenas em `src/infrastructure`.
- Testes unitarios nao conectam no banco real.

## Comandos

```bash
npm install
npm run dev
npm run test
npm run typecheck
```

`npm run dev` gera o build e serve a pasta `dist` em `http://127.0.0.1:5173`.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Sem essas variaveis, a interface usa produtos e pedidos em memoria apenas em
desenvolvimento. Em producao, o aplicativo bloqueia a inicializacao ate que
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estejam configuradas.

Com essas variaveis preenchidas, a interface usa:

- `SupabaseProductRepository`
- `SupabaseOrderRepository`

## URLs

- Cliente: `/`
- Admin: `/admin`

O arquivo `vercel.json` configura rewrite para o React assumir essas rotas em
producao.

## Banco de dados

O schema inicial esta em:

```text
supabase/schema.sql
```

Ele define as tabelas `products`, `orders` e `order_items`.

As policies publicas minimas para o MVP estao em:

```text
supabase/policies.sql
```

Elas permitem:

- leitura de produtos ativos
- criacao publica de pedidos apenas pela RPC `create_order_with_items`
- leitura e gestao administrativa apenas para usuarios autenticados com `app_metadata.role = "admin"`

O painel administrativo usa Supabase Realtime para atualizar pedidos novos sem
clique manual. O `supabase/schema.sql` adiciona `public.orders` na publication
`supabase_realtime` quando ela existir. Se necessario, confirme no painel do
Supabase que Realtime esta habilitado para a tabela `orders`.

O dono da aplicacao pode ajustar no painel administrativo:

- loja aberta ou fechada para novos pedidos
- taxa de entrega

Essas configuracoes ficam em `app_settings` e sao usadas pela RPC de criacao de
pedido para recalcular os valores no banco.

A RPC de criacao de pedido tambem bloqueia novo pedido quando ja existe pedido
ativo para o mesmo telefone. Pedidos finalizados ou cancelados nao bloqueiam uma
nova compra.

O cliente pode consultar um pedido pelo numero e telefone e cancelar enquanto o
pedido ainda estiver `PENDING` ou `ACCEPTED`. Esse cancelamento passa pela RPC
`cancel_customer_order`, que valida o numero do pedido e o telefone antes de
alterar o status para `CANCELED`.

O aviso sonoro de novo pedido depende de uma interacao inicial do navegador. No
painel admin, clique em `Ligar som` apos entrar para desbloquear o audio.

Para tornar um usuario administrador no Supabase, edite o usuario em
`Authentication > Users` e defina o `app_metadata` assim:

```json
{
  "role": "admin"
}
```

Para o dono da aplicacao, que tambem pode bloquear/liberar a aplicacao, use:

```json
{
  "role": "admin",
  "owner": "true"
}
```

Depois disso, o usuario deve sair e entrar novamente para receber um JWT
atualizado.

## Checklist de producao

- Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no provedor de deploy.
- Aplicar `supabase/schema.sql` e `supabase/policies.sql` no projeto Supabase.
- Confirmar que existe ao menos um usuario com `app_metadata.role = "admin"`.
- Confirmar que o dono tem `app_metadata.owner = "true"`.
- Confirmar Realtime habilitado para `orders` e `app_settings`.
- Testar cliente criando pedido, admin atualizando status e cliente consultando
  pedido pelo numero e telefone.

## Fluxo XP/TDD

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

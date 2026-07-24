# 🍢 Espetaria

> Aplicativo para gerenciamento de uma **espetaria** com pedidos por **delivery** e **retirada**, contendo área do cliente e painel administrativo.

---

## ✨ Tecnologias

| Tecnologia | Descrição |
|------------|-----------|
| ⚛️ React | Interface da aplicação |
| 📘 TypeScript | Tipagem estática |
| ⚡ Vite | Build e desenvolvimento |
| 🧪 Vitest | Testes unitários |
| 🐘 Supabase PostgreSQL | Banco de dados |
| ▲ Vercel | Deploy |

---

# 📂 Arquitetura

O projeto segue princípios de **Clean Architecture**, separando responsabilidades em camadas.

```text
src/
├── domain/
├── application/
├── infrastructure/
└── ui/
```

### Regras da arquitetura

- ✅ O domínio não conhece UI, Supabase ou infraestrutura.
- ✅ Casos de uso dependem apenas das interfaces em `src/application/repositories`.
- ✅ Implementações do Supabase ficam exclusivamente em `src/infrastructure`.
- ✅ Testes unitários nunca utilizam o banco de dados real.

---

# 🚀 Instalação

```bash
npm install
```

---

# ▶️ Executando o projeto

### Desenvolvimento

```bash
npm run dev
```

A aplicação ficará disponível em:

```
http://127.0.0.1:5173
```

---

### Testes

```bash
npm run test
```

---

### Verificação de tipos

```bash
npm run typecheck
```

---

# ⚙️ Variáveis de ambiente

Copie o arquivo:

```text
.env.example
```

para

```text
.env.local
```

e preencha:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Sem variáveis

Durante o desenvolvimento, o sistema utiliza dados em memória para:

- Produtos
- Pedidos

---

## Com variáveis

O sistema passa a utilizar os repositórios reais:

- `SupabaseProductRepository`
- `SupabaseOrderRepository`

---

## Produção

Em produção, a aplicação **não inicia** caso as variáveis abaixo não estejam configuradas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

# 🌐 Rotas

| Página | URL |
|---------|-----|
| 🛒 Cliente | `/` |
| 👨‍💼 Administração | `/admin` |

O arquivo **vercel.json** já está configurado para realizar o rewrite das rotas.

---

# 🗄️ Banco de Dados

Os scripts do banco estão em:

```text
supabase/schema.sql
```

Define as tabelas:

- `products`
- `orders`
- `order_items`
- `app_settings`

---

## Policies

As policies estão em:

```text
supabase/policies.sql
```

Elas permitem:

- ✅ Leitura pública dos produtos ativos.
- ✅ Criação pública de pedidos via RPC.
- ✅ Administração apenas para usuários autenticados com:

```json
{
  "role": "admin"
}
```

---

# 📦 RPCs

## Criar Pedido

A RPC:

```text
create_order_with_items
```

é responsável por:

- criar o pedido
- criar os itens
- recalcular os valores
- aplicar taxa de entrega
- verificar se a loja está aberta
- impedir pedidos duplicados pelo mesmo telefone

Pedidos com status:

- `FINISHED`
- `CANCELED`

não impedem novas compras.

---

## Cancelar Pedido

A RPC:

```text
cancel_customer_order
```

permite que o cliente cancele um pedido informando:

- número do pedido
- telefone

O cancelamento só é permitido quando o pedido estiver:

- `PENDING`
- `ACCEPTED`

---

# 🔔 Realtime

O painel administrativo utiliza **Supabase Realtime**.

Novos pedidos aparecem automaticamente sem necessidade de atualizar a página.

Caso necessário, confirme no painel do Supabase que a tabela:

```
orders
```

está com o Realtime habilitado.

Também é recomendado habilitar:

```
app_settings
```

---

# ⚙️ Configurações da Loja

O proprietário pode alterar pelo painel administrativo:

- 🟢 Loja aberta/fechada
- 🚚 Taxa de entrega

Essas configurações ficam armazenadas em:

```text
app_settings
```

e são utilizadas pela RPC de criação de pedidos.

---

# 🔊 Som de novos pedidos

Por questões de segurança dos navegadores modernos, o áudio só funciona após uma interação do usuário.

Ao entrar no painel administrativo, clique em:

```
Ligar som
```

para liberar o áudio das notificações.

---

# 👤 Administradores

No painel do Supabase:

```
Authentication
→ Users
```

defina o `app_metadata` do usuário.

Administrador:

```json
{
  "role": "admin"
}
```

---

## Proprietário

```json
{
  "role": "admin",
  "owner": "true"
}
```

Após alterar o `app_metadata`, faça logout e login novamente para atualizar o JWT.

---

# ✅ Checklist de Produção

- [ ] Configurar `VITE_SUPABASE_URL`
- [ ] Configurar `VITE_SUPABASE_ANON_KEY`
- [ ] Executar `supabase/schema.sql`
- [ ] Executar `supabase/policies.sql`
- [ ] Criar um usuário administrador
- [ ] Configurar o proprietário (`owner`)
- [ ] Habilitar Realtime para `orders`
- [ ] Habilitar Realtime para `app_settings`
- [ ] Testar criação de pedidos
- [ ] Testar atualização de status pelo admin
- [ ] Testar consulta de pedidos pelo cliente
- [ ] Testar cancelamento de pedidos

---

# 🧪 Fluxo de Desenvolvimento (XP + TDD)

```text
💡 Ideia
      │
      ▼
📋 Regras do Projeto
      │
      ▼
🧪 Escrever Testes
      │
      ▼
⚙️ Implementação Mínima
      │
      ▼
✅ Testes Passando
      │
      ▼
♻️ Refatoração
      │
      ▼
✨ Nova Feature
      │
      ▼
🚀 Deploy
```

---

# 📁 Estrutura do Projeto

```text
.
├── src
│   ├── application
│   ├── domain
│   ├── infrastructure
│   └── ui
│
├── supabase
│   ├── schema.sql
│   └── policies.sql
│
├── .env.example
├── vercel.json
└── README.md
```

---

# ❤️ Desenvolvido com

- React
- TypeScript
- Vite
- Supabase
- Clean Architecture
- TDD
- XP

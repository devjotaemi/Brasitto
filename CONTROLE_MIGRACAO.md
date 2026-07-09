# Controle de migracao - Espetaria

Este arquivo registra o estado do projeto, decisoes, planos e alteracoes para que outra IA ou desenvolvedor consiga assumir o trabalho sem perder contexto.

## Regras operacionais

- Registrar neste arquivo todas as alteracoes relevantes feitas no projeto.
- Antes de implementar qualquer feature, detalhar o plano de execucao.
- Depois de detalhar o plano de uma feature, pedir aprovacao explicita antes de implementar.
- Ao finalizar alteracoes, executar os testes aplicaveis e registrar o resultado.
- Preservar a separacao entre dominio, aplicacao, infraestrutura e UI.
- Testes de dominio e aplicacao nao devem depender do banco real.

## Estado atual

- Projeto copiado de um cliente anterior do ramo alimenticio.
- Novo objetivo: adaptar para um restaurante de espetos.
- Deploy ja foi feito na Vercel.
- Projeto ja esta apontando para o banco Supabase correto da espetaria.
- Stack atual: React, TypeScript, Vite, Vitest, TailwindCSS, Supabase PostgreSQL e Vercel.
- Banco atual cobre produtos, pedidos, itens de pedido, configuracoes da loja, bloqueio da aplicacao, RPCs publicas e policies.

## Pendencias principais da migracao

1. Trocar identidade visual e textos do cliente anterior para a espetaria.
2. Remover termos especificos do produto antigo na UI, documentacao e mensagens.
3. Cadastrar ou importar o cardapio real de espetos no Supabase.
4. Validar fluxo completo em producao:
   - cliente cria pedido;
   - admin recebe pedido;
   - admin altera status;
   - cliente consulta status;
   - WhatsApp abre com mensagem correta;
   - loja fechada bloqueia novos pedidos.
5. Confirmar usuarios administrativos no Supabase Auth com `app_metadata.role = "admin"` e dono com `app_metadata.owner = "true"`.
6. Confirmar Realtime habilitado para `orders` e `app_settings`.

## Plano antes da proxima implementacao

Antes de editar features, seguir este plano:

1. Mapear todas as referencias ao cliente antigo com `rg`.
2. Separar alteracoes em grupos pequenos:
   - identidade/nome;
   - textos do cliente;
   - textos do admin;
   - mensagens de WhatsApp;
   - documentacao;
   - seed/cardapio.
3. Para cada grupo, ajustar testes quando houver comportamento coberto.
4. Rodar `npm.cmd run test` e `npm.cmd run build`.
5. Registrar neste arquivo o que foi alterado e o resultado dos testes.

## Log de alteracoes

### 2026-07-08

- Criado este arquivo de controle da migracao.
- Registradas as regras permanentes solicitadas:
  - documentar alteracoes;
  - planejar antes de implementar;
  - verificar testes ao final.
- Nenhuma feature foi implementada nesta etapa.
- Verificacao executada:
  - `npm.cmd run test`: passou com 27 arquivos de teste e 110 testes.
  - `npm.cmd run build`: passou; Vite gerou `dist/`.

### 2026-07-08 - Migracao de textos para espetaria

Plano detalhado antes da implementacao:

1. Mapear todas as referencias ao cliente anterior e aos produtos fake antigos.
2. Trocar identidade e textos para Espetaria e espeto/espetos.
3. Ajustar produtos locais de fallback para espetos.
4. Criar SQL de seed separado para produtos de teste da espetaria.
5. Rodar testes e build ao final.

Alteracoes realizadas:

- Nome do projeto e titulo trocados para Espetaria.
- Textos publicos e administrativos trocados para espeto/espetos.
- Mensagens de WhatsApp ajustadas para Espetaria.
- Testes ajustados para os novos nomes de produtos e endereco de exemplo.
- Produtos locais de fallback trocados para espetos.
- Criado `supabase/seed-espetaria.sql` com produtos de teste.

Verificacao executada:

- `npm.cmd run test`: passou com 27 arquivos de teste e 110 testes.
- `npm.cmd run build`: passou; Vite gerou `dist/`.
- O build manteve avisos conhecidos do `lucide-react` sobre diretivas `"use client"` ignoradas pelo bundler.

### 2026-07-08 - Upload de fotos dos produtos

Plano detalhado antes da implementacao:

1. Manter `products.image_url` como fonte da imagem exibida no cliente.
2. Trocar a edicao manual de URL no admin por upload de arquivo.
3. Usar Supabase Storage para armazenar as imagens em bucket publico.
4. Gerar URL publica apos upload e salvar essa URL no produto.
5. Criar SQL para bucket e policies de Storage.
6. Preservar produtos que ja possuem URL de foto.
7. Rodar testes e build ao final.

Alteracoes realizadas:

- Admin de produtos agora aceita arquivo de imagem em vez de URL manual.
- Upload usa o bucket `product-images` do Supabase Storage.
- Ao salvar produto, a foto selecionada e enviada ao Storage e a URL publica e gravada em `products.image_url`.
- O formulario exibe preview da foto atual ou da nova foto selecionada.
- Criado `supabase/product-image-storage.sql` para configurar bucket e policies.

Verificacao executada:

- `npm.cmd run test`: passou com 27 arquivos de teste e 112 testes.
- `npm.cmd run build`: passou; Vite gerou `dist/`.
- O build manteve avisos conhecidos do `lucide-react` sobre diretivas `"use client"` ignoradas pelo bundler.
- O build tambem avisou que um chunk passou de 500 kB apos minificacao; nao bloqueia o deploy.

### 2026-07-08 - Comandas no admin

Plano detalhado antes da implementacao:

1. Criar comandas como fluxo separado de pedidos delivery/retirada.
2. Criar dominio `Comanda` com status `OPEN`, `CLOSED` e `CANCELED`.
3. Criar use cases para abrir, listar, adicionar item, cancelar item e fechar comanda.
4. Criar tabelas `comandas` e `comanda_items` no Supabase.
5. Criar policies admin-only para comandas.
6. Criar repositório Supabase e repositório local de comandas.
7. Adicionar aba `Comandas` no painel administrativo.
8. Rodar testes e build ao final.

Alteracoes realizadas:

- Criado dominio `src/domain/comanda/Comanda.ts`.
- Criados contratos e use cases de comandas.
- Criado `SupabaseComandaRepository`.
- `createCustomerDependencies` agora fornece use cases de comandas.
- `supabase/schema.sql` recebeu tabelas, sequence, indices e realtime para comandas.
- `supabase/policies.sql` recebeu grants e policies admin-only para comandas.
- Criado `AdminCommandasPanel` com abertura de comanda, inclusao de itens, cancelamento de item e fechamento.
- `AdminApp` ganhou a aba `Comandas`.
- Criados testes de dominio e aplicacao para comandas.

Pendente para producao:

- Rodar `supabase/schema.sql` e `supabase/policies.sql` no projeto Supabase antes de usar a aba `Comandas` em producao.

Verificacao executada:

- `npm.cmd run test`: passou com 29 arquivos de teste e 117 testes.
- `npm.cmd run build`: passou; Vite gerou `dist/`.
- O build manteve avisos conhecidos do `lucide-react` e chunk acima de 500 kB.

### 2026-07-08 - Regra de aprovacao antes de features

Alteracoes realizadas:

- Registrada regra operacional: depois de detalhar o plano de uma feature, pedir aprovacao explicita antes de implementar.

Verificacao executada:

- `npm.cmd run test`: passou com 27 arquivos de teste e 112 testes.

### 2026-07-08 - Fotos dos produtos

Plano detalhado antes da implementacao:

1. Entender como `Product` e persistido e exibido no cliente/admin.
2. Adicionar foto opcional no dominio como `imageUrl` e no banco como `image_url`.
3. Manter compatibilidade com produtos existentes sem foto.
4. Exibir foto no cardapio do cliente e no painel de produtos.
5. Permitir editar a URL da foto no admin.
6. Criar SQL para atualizar o banco ja populado com URLs de teste.
7. Rodar testes e build ao final.

Alteracoes realizadas:

- `Product` agora aceita `imageUrl` opcional.
- `SupabaseProductRepository` le e grava `image_url`.
- `SaveProductUseCase` aceita `imageUrl`.
- Cardapio do cliente exibe imagem do espeto ou fallback "Sem foto".
- Admin de produtos exibe imagem e permite editar a URL da foto.
- `supabase/schema.sql` adiciona `products.image_url`.
- `supabase/seed-espetaria.sql` agora inclui `image_url`.
- Criado `supabase/product-images.sql` para adicionar a coluna e preencher fotos nos produtos ja cadastrados.

Verificacao executada:

- `npm.cmd run test`: passou com 27 arquivos de teste e 112 testes.
- `npm.cmd run build`: passou; Vite gerou `dist/`.
- O build manteve avisos conhecidos do `lucide-react` sobre diretivas `"use client"` ignoradas pelo bundler.

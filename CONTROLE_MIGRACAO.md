# Controle de migracao - Espetaria

Este arquivo registra o estado do projeto, decisoes, planos e alteracoes para que outra IA ou desenvolvedor consiga assumir o trabalho sem perder contexto.

## Regras operacionais

- Registrar neste arquivo todas as alteracoes relevantes feitas no projeto.
- Antes de implementar qualquer feature, detalhar o plano de execucao.
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

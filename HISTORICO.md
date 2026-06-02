# Decora-ai / WayDecor — HISTORICO

Domínio prod: https://waydecor.12brain.org (também responde decora.12brain.org)
PM2 process: `decora-api` (id 63), porta `:8018` (server.mjs)
Nginx serve `/root/projetos/Decora-ai/dist/` (build Vite estático)
Frontend: monolito React 19 em `App.tsx` (1.7k linhas), build via `npm run build`
Backend: `server.mjs` Node nativo + MongoDB (`decore_ai`)
AI: Gemini 2.5 Flash (texto) + Gemini 2.5 Flash Image (renderer)

## Integrações ativas
- MongoDB Atlas (mongo://...): coleções `styles`, `config`, `credits`, `projects`
- Gemini API (Google GenAI SDK) — key em `.env` server-side
- Stripe (frontend `@stripe/stripe-js`) — paywall créditos
- Tailwind CDN runtime (`cdn.tailwindcss.com`) — **risco**: JIT em runtime falha com arbitrary values dinâmicos, deve migrar pra Tailwind v4 inline em algum momento

## Sessões

### 2026-06-02 — Fix: estilos invisíveis + IA mudando arquitetura
**Commit:** `d356881`

**Bugs reportados:**
1. Estilos de decoração não aparecem na UI mesmo com `/api/styles` retornando 24 itens
2. Sistema continua mudando arquitetura do ambiente apesar de 3 commits seguidos tentando travar (`0535a61`, `2c632af`, `a57961b`)

**Causa raiz Bug 1:** Tailwind CDN JIT runtime não conseguia gerar classes `from-[#xxx] via-[#xxx] to-[#xxx]` dinâmicas vindas do map `STYLE_GRADIENTS`. Grid de 24 cards renderizava transparente. **Decisão do dono:** remover a grid e substituir por banner com input livre opcional (José, esta sessão).

**Causa raiz Bug 2:** geração tem 2 passos: LLM-1 (`gemini-2.5-flash`) gera `enhancedDescription` texto-livre, LLM-2 (`gemini-2.5-flash-image`) renderiza. As travas GEOMETRY LOCK estavam só no boilerplate; nada impedia o LLM-1 de descrever _"open up wall"_, _"raise ceiling"_ no enhancedDescription, que o renderer obedecia.

**Mudanças (App.tsx):**
- `STYLE_GRADIENTS` migrado de Tailwind classes para CSS `linear-gradient(...)` inline
- Removida grid de 24 cards; novo banner com `<textarea>` "Direção de estilo (opcional)"
- `customStyleHint` state novo; `selectedStyleId` mantido pra quickSwitch legacy
- `canGenerateDecoration` agora exige só loja ativa
- `creativePrompt` (LLM-1): novo OUTPUT CONSTRAINT com lista negra de verbos estruturais, força output a começar com _"Within the existing room shell..."_
- `renderPrompt` (LLM-2): FINAL OVERRIDE depois da enhancedDescription, manda ignorar qualquer parte que sugira mudança geométrica
- i18n styleHint* em pt, en, es

**Estado pós-deploy:**
- ✅ Bundle novo `index-BGS4YOBw.js` (cache-bust automático)
- ✅ Site HTTP 200, `/api/styles` ainda retorna 24
- ✅ pm2 decora-api online :8018
- ✅ Push pra `origin/main` OK

**Pendente / a verificar:**
- [ ] José precisa validar visualmente em prod (aba anônima): textarea aparece, geração funciona sem direção, geração funciona com direção, geometria preservada
- [ ] Migrar Tailwind CDN runtime → Tailwind v4 inline (risco recorrente de bugs visuais)
- [ ] `/api/config` retorna `[]` — `DEFAULT_SYSTEM_MEMORY` ainda governa. Avaliar se o painel admin de protocols (`ARCHITECT_PROTOCOL`, `RENDERER_PROTOCOL`) está integrado
- [ ] Bundle 696KB único — Vite avisou pra code-split

## Endpoints
- `GET /api/health` → `{ok, storage, database}`
- `GET /api/providers` → lista de lojas (Wayfair, Target, ...)
- `GET /api/styles` → 24 estilos (Mongo)
- `POST /api/styles/seed` → upsert lista
- `GET /api/config` → `[]` atualmente
- `GET /api/credits?clientId=` → saldo
- `POST /api/credits/deduct` → debita
- `POST /api/gemini/generate` → proxy Gemini
- `POST /api/catalog/validate` → valida nome de item na loja
- `GET|POST /api/projects` → CRUD projeto salvo

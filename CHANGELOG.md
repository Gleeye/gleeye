# Changelog Gleeye ERP

Cosa è stato fatto, sessione per sessione. Lo aggiorno io (Claude) al volo,
così Davide può aprire questo file dall'editor e vedere lo stato senza dover
guardare la cronologia git o la memoria interna di Claude.

Branch attivo principale: `feature/ai-foundation`.

---

## 2026-05-13 / 2026-05-14 — Fase 0: Fondamenta trasversali

### Step 1-3 — AI Observability (foundation)

- **DB**: migration `create_ai_usage_log_observability` applicata.
  Nuova tabella `ai_usage_log` con tutti i campi per tracciare ogni chiamata
  AI (user, feature, model, tokens, costo USD/EUR, latenza, errori).
  Aggiunta anche la view `ai_usage_monthly_summary`.
- **Edge function** `ai-proxy` (Deno/TypeScript) deployata su Supabase:
  fa da gateway verso OpenRouter, applica JWT auth, logga in
  `ai_usage_log` in fire-and-forget. La chiave OpenRouter sta nei Secret
  Supabase, mai esposta al client.
- **Frontend**: `js/modules/ai_client.js` esporta `ai.chat()`,
  `ai.complete()`, `ai.completeJSON()`. Modelli configurati per feature
  (Gemini Flash 2.5 Lite per UI conversational, Claude Sonnet 4.5 per
  doc generator / pricing / sales). Esposto come `window.ai`.

### Step 4 — Cmd+K palette (MVP)

- `js/features/cmd_palette.js`: palette accessibile con `Cmd+K` (Mac) o
  `Ctrl+K` (Windows). 5 tool function-calling registrati: navigate_to,
  search_entity, open_entity_detail, quick_stat (10 metriche reali via
  query Supabase), answer_question.
- UI overlay glassmorphism con autofocus, loader, 5 suggerimenti rapidi.
- Modello: Gemini Flash 2.5 Lite. Costo per chiamata: ~0,0001-0,0005 €.

### Step 5 — Razionalizzazione campi tecnici

- **Filosofia**: prima rename umano, poi tooltip statico (HTML hover),
  AI inline solo dove serve contesto dinamico.
- `js/modules/help_tooltip.js`: glossario fiscale italiano (P.IVA, CF,
  PEC, SDI, IBAN, CAP, Regime Ordinario/Forfettario/Occasionale,
  Ritenuta d'Acconto, Rivalsa INPS, Cassa Previdenza, Bollo virtuale,
  Esigibilità IVA, Split Payment, Reverse Charge, ATECO, SAP, WL, OdA)
  + componente "?" con tooltip on-hover. **Zero chiamate AI**.
- Applicato a `clients.js`, `collaborators.js`, `suppliers_v2.js`,
  `invoices.js` (fatture passive).
- Date format: 21 occorrenze `toLocaleDateString()` → `toLocaleDateString('it-IT')`
  in 14 file. Ora il formato è sempre DD/MM/YYYY, nessuna ambiguità.

### Step 5b — i18n status enum

- `js/modules/i18n_labels.js`: dizionario centralizzato che traduce
  status DB → etichette italiane. Copre assignment status
  (Completed→Completato, Active→Attivo, In Progress→In corso),
  payment status, order works/offer/sales, invoices, bank_transactions,
  leads. Una sola fonte di verità.
- Applicato a `orders.js` e `collaborators.js` (tab Incarichi).

### Step 7 — Dashboard Consumi AI (in Amministrazione → tab "Consumi AI")

- `js/features/admin/ai_usage_dashboard.js`: 4 KPI (costo mese corrente
  + delta vs mese scorso, chiamate totali, token totali, latenza media),
  breakdown per **feature** + breakdown per **utente** (chi consuma di
  più), tabella ultime 50 chiamate con utente, modello, costo €/chiamata,
  latenza, esito.
- Integrato come nuova tab nel pannello Amministrazione esistente.

### Bug fix tooltip (post-feedback Davide del 14/5)

- Tooltip ora è un elemento DOM reale (non pseudo-element), posizionato
  con JS runtime: auto-flip in basso se manca spazio sopra (es. label
  vicino al titolo del modal), clamp dentro al viewport quando deborda
  a destra/sinistra. Max-width responsivo: 320px ma mai > 90vw.
- Caso "4 ? affiancati" sul "Regime fiscale del fornitore": sostituiti
  con 1 solo tooltip composito (`regime_fiscale_overview`) che elenca
  tutti i regimi insieme. Stesso pattern per "Dati Fiscali" del cliente
  (3 ? → 1 ?).

### Step 6 — Bug fix actor frontend (post-DB-fix del 12/5)

- `pm_activity_helper.js`: nuova fn `resolveUserNameByUuid(uuid)` che cerca
  in state.profiles + state.collaborators (anche via user_id link) per
  risolvere UUID grezzi in nome leggibile.
- `resolveActorName()`: chain finale a 6 step (full_name del join → email
  local part → lookup state UUID → 'Utente sconosciuto' → 'Sistema').
- Per il target dell'assegnazione ("ha assegnato a..."): prima di cadere
  su "un utente" si prova il lookup UUID. Fallback ora è "un collaboratore".
- `pm/space_view.js`: "Sconosciuto" → split email come fallback più umano.

### Permission allowlist per autonomia notturna

- `.claude/settings.local.json`: pre-approvati i tool read-only e i
  comandi git di routine (status, diff, add, commit, push, log, branch,
  checkout) + node --check, grep, ls, find, sed, awk. Operazioni
  distruttive (migration DB, push --force, rm) restano sotto consenso
  esplicito. Serve a far andare avanti Claude di notte senza bloccarsi
  in attesa del consenso utente.

---

## Convenzioni

- **Branch attivo**: `feature/ai-foundation` (PR aperta).
- **Branch parallelo (sessione separata)**: `feature/sap-doc-generator`
  (lavora un'altra istanza Claude su SAP Documentation Generator —
  vedi roadmap nel memory).
- **Cache busting**: i moduli nuovi hanno `?v=8001` o `?v=8002`.
  Quando aggiorno un modulo bumpo il param.
- **Test in locale**: dev server su `localhost:8090` (`python3 -m http.server 8090`).
- **Test in produzione**: la app deployata è ancora sul vecchio codice
  finché non si fa il merge della PR. Davide testa prima in locale,
  poi merge quando approva.

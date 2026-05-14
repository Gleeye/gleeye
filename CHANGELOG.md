# Gleeye ERP — Manuale operativo

Cosa è in produzione su `workspace.gleeye.eu` (deploy auto da `main` via Vercel).
Lo aggiorno io (Claude) sessione per sessione. Apri da qualsiasi editor.

---

## In sintesi: cosa puoi fare adesso

### Cmd+K — la "barra di comando" che apri ovunque (Cmd+K Mac / Ctrl+K Win)
Scrivi in italiano, l'AI capisce e fa. **12 azioni disponibili:**

| Frase | Cosa succede |
|---|---|
| "vai ai clienti" | Apre vista clienti |
| "apri commessa Acme" | Apre dettaglio commessa |
| "cerca collaboratore Mario" | Mostra match |
| "quante fatture scadute" | Risposta numerica |
| "monthly revenue corrente" | KPI ricavi del mese |
| "cosa devo fare oggi" | Recap: task, pagamenti, fatture scadute |
| "cosa è scaduto" | Lista completa scaduti con totali |
| "come sta cliente Rossi" | Dashboard cliente con KPI |
| "crea task chiamare Mario per domani" | Crea task in DB con scadenza |
| "registra spesa Adobe 50 euro" | Apre modal fattura passiva precompilato |
| "incassato 1500 da Acme" | Registra movimento bancario in attesa |
| "fissa call con Mario domani alle 15" | Crea appuntamento + agenda |

Modello: Gemini 2.5 Flash Lite. Costo per chiamata: ~0,00005 €.

### Homepage admin
- **Briefing del mattino AI** in cima — riassunto in italiano colloquiale di cosa è importante oggi (1 generazione/giorno, bottone "rigenera" disponibile).
- **Centro Alert** — widget con 6 voci aggregate: fatture scadute, pagamenti in ritardo, task urgenti, movimenti bancari orfani, fatture passive in attesa di revisione, raccomandazioni AI Pricing nuove.

### Anagrafiche (clienti / collab / fornitori / partner WL)
- Tooltip "?" sui campi fiscali italiani: P.IVA, Codice Fiscale, PEC, Codice SDI, IBAN, CAP, Regime ordinario/forfettario/occasionale, Ritenuta d'acconto, Rivalsa INPS, Cassa Previdenza, Bollo virtuale.
- Niente più sigle oscure: placeholder umani ("Provincia", "CAP 5 cifre", ecc.).

### Fatture passive (Amministrazione)
- Bottone **"✨ Importa con AI"** nell'header del modal Nuova Fattura. Carichi un PDF → l'AI legge il PDF, estrae numero/data/importi/regime/codici riferimento → precompila tutto il modal + ti riconosce il fornitore.
- Auto-spunta i pagamenti collaboratore che questa fattura sta saldando (score importo + codice riferimento).
- Funziona sia per fatture **collaboratori** sia per **fornitori B2B** sia per **partner WL** (rileva mode dal contesto).
- PDF auto-allegato al modal (non devi ricaricarlo per salvare).

### Incarichi (assignments)
- **Vista role-based**: se chi apre l'incarico è il collaboratore stesso, il detail cambia:
  - Niente dati economici interni (tariffario, delta, margini)
  - "Importo Incarico" → "Compenso Concordato" (verde)
  - Bottoni admin (modifica/elimina/email) nascosti
  - Status read-only invece di dropdown editabile
  - Note PM nascoste
  - Bottone **"❓ Cosa devo fare?"** che chiama AI per spiegare in italiano semplice cosa fare in quell'incarico
- **Hub Operativo** (sotto le 3 colonne, solo collab view):
  - "Task da fare": le sue pm_items della commessa, priorità + scadenza
  - "Prossimi appuntamenti": appointments della commessa con lui partecipante

### Task (Le mie task)
- **5 filtri** invece di 3: Tutto / Le mie / **Responsabile** / **Da revisionare** / Delegate (pattern R-A-R).
- **LT-1 fix**: le task urgenti senza data ora appaiono nel bucket "Urgent" invece di sparire in "Future".

### Pricing Intelligence (nuova rotta `#pricing` in Amministrazione)
Dashboard con 5 sezioni di analisi AI:
1. **Win/Loss** — accettata vs rifiutata per servizio/categoria
2. **Margin Calibration** — prezzo vs costo vs margine per ordine
3. **Sensitivity** — quali servizi tollerano aumenti
4. **Prezzi Ottimali** — suggerimento per ogni servizio del tariffario
5. **Lost Deal Recovery** — ordini rifiutati ultimi 6 mesi con motivazioni

### Bank Movimenti Orfani (in Amministrazione)
Vista che lista i bank_transactions degli ultimi 90 giorni senza match a fatture/pagamenti. Per ogni movimento: dropdown "Collega a..." + bottone "AI Suggest" che propone il match più probabile.

### CFO Virtuale (Amministrazione)
- **`#cfo-cashflow`** — Cash flow 90 giorni con grafico, evidenzia giorni in negativo
- **`#cfo-pnl-orders`** — P&L per ogni commessa (ricavi, costi diretti, margine % + grafico distribuzione)
- **`#cfo-aging`** — Aging fatture clienti (0-30, 31-60, 61-90, 90+ giorni)
- **`#cfo-dso-dpo`** — DSO/DPO con trend 12 mesi
- **`#cfo-breakeven`** — Distinta base + break-even per SAP
- **`#cfo-forecast`** — Piano economico annuale con confronto actual

### Sales Engine (nuova rotta in app)
- Kanban 5 stadi: Cold → Contatto inviato → Risposto → Proposta inviata → Convertito
- Lead Enrichment AI per ogni lead (settore, dimensione team)
- Metriche pipeline (conversion rate, tempo medio per stadio)
- Outreach Drafter: bottone "Genera email" → 3 varianti pronte da copiare

### SAP Services (sessione parallela completata)
- 8 mine SAP: form dati AI, Documentation Generator, vista catalogo in-app, crea ordine 1-click da SAP, analisi AI quali SAP costruire, KPI dashboard, PM Template Generator AI

### Amministrazione (tab "Consumi AI")
Dashboard 4 KPI (costo mese vs precedente, chiamate totali, token totali, latenza media) + breakdown per feature + breakdown per utente + tabella ultime 50 chiamate.

---

## Configurazione tecnica (per il futuro)

- **Modello AI**: `google/gemini-2.5-flash-lite` per TUTTE le feature (default centralizzato in `js/modules/ai_client.js`). Se vorrai cambiarne uno specifico in futuro, basta modificare `AI_MODELS[feature]`.
- **Gateway AI**: OpenRouter via edge function `ai-proxy`. JWT auth, logging fire-and-forget in `ai_usage_log`.
- **Costo medio**: ~0,00005 € per chiamata Cmd+K, ~0,001-0,01 € per chiamata complessa (parsing PDF, analisi Pricing).
- **PDF parsing**: pdfjs-dist lato browser, niente edge function pesante.
- **Deploy**: push su `main` → Vercel autodeploy su `workspace.gleeye.eu`.

---

## Cronologia tecnica sintetica

**13/14 maggio 2026** — sessione massiva con sessioni parallele:

- Fase 0: AI foundation (`ai-proxy` + `ai_client` + `ai_usage_log` + Dashboard consumi), Cmd+K MVP con 5 tool, razionalizzazione campi fiscali con glossario, i18n status enum, fix actor name fallback chain.
- Fase 1 step 9: AI import fatture passive da PDF (estrazione browser, OpenRouter+Gemini, supplier match, auto-flag pagamenti, auto-attach PDF).
- Mina A: vista role-based detail incarichi (admin vs collab).
- Mina D: Hub operativo nell'incarico (task + appuntamenti filtrati per collab).
- Mina PM-7: viste R-A-R nelle task (5 filtri) + fix LT-1.
- Cmd+K esteso: recap_today, overdue_overview, client_summary.
- Cmd+K azionabile: create_task, log_expense, log_payment_received, create_appointment.
- 3 sessioni parallele: Pricing Intelligence (5 fasi), Bank Orphans (CA-8), CFO Phase 1+Phase 2-3 (cashflow, P&L, Aging, DSO/DPO, Break-even, Forecast), Sales Engine Phase 1, Homepage Alerts widget.
- SAP Documentation Generator (8 mine, sessione parallela).
- Help inline AI contestuale (modulo + integrazione collab view incarichi).
- Briefing del mattino AI in homepage.
- Fix sistemico modelli AI: tutti forzati a `gemini-2.5-flash-lite`.
- Batch "decidi tu" 4/4 (14-15 maggio):
  1. Stato cliente auto-calcolato (Lead/Potenziale/Attivo/Dormante/Perso) — derivato live da ordini + fatture, niente più flag a mano.
  2. Cascade automation `status_works = completato` — trigger SQL + toast frontend (archivio pm_space, task follow-up, suggerimento fattura finale).
  3. Cleanup tag collaboratori — 3 formati storici (single, CSV, JSON array) unificati in JSON array via migration `normalize_collaborator_tags`.
  4. **Cost dinamico per collab** — nuova tabella `collaborator_service_rates` (61 record backfillati) con trigger di mantenimento avg/min/max/last/sample_size + RPC `get_collaborator_service_rate`. In assignment modal: hint ambra "Usa € X" con la tariffa storica del collab quando differisce dal listino.

**14 maggio 2026** — pomeriggio:
- **Account responsabile come campo dedicato sul cliente** — `clients.account_responsible_id` (FK collaborators), backfill euristico 39/83 clienti. UI: header dettaglio cliente con avatar iniziali + picker modale, mini-avatar nella rubrica, filtro sidebar per account, campo nel modal Nuovo/Modifica.
- **Margine effettivo nell'hub commessa** — nuova card "Margine Effettivo" sotto "Margine Teorico (da preventivo)": calcola live dagli `assignments.amount` reali. Banner "Costo reale vs preventivo (±%)". Solo per ruoli privilegiati.
- **Alert margine eroso nel Centro Alert homepage** — 7ª voce del widget: commesse accettate con erosione costo > 10% rispetto al `cost_final`. Click → apre la commessa peggiore.
- **Mina F: auto-completamento incarico** — trigger `fn_assignment_auto_complete_on_payments`: quando tutti i payments collab di un assignment sono `Completato` E lo stato era `Terminato da saldare` → l'app chiude da sola l'incarico portandolo a `Completato`. Backfill ha chiuso 6 incarichi storici già in coda.

---

## Aree non ancora coperte / decisioni Davide

- **SDI nativo** (emettere fatture direttamente dall'app senza Aruba) — richiede accreditamento SDI.
- **Email integration** per Auto-import fatture passive da inbox dedicata — serve scelta provider (SendGrid / Mailgun / Postmark) + DNS MX.
- **Bank Sync Open Banking** (PSD2 sync giornaliero automatico) — serve scelta provider (TINK / Yapily / GoCardless) + credenziali.
- **Multi-tenant SaaS** — opzione architetturale, non attiva.
- **Mobile-first refactor** — l'app funziona su mobile ma il design non è native mobile-first.

---

## Convenzioni interne

- **Branch**: feature/* per ogni lavoro, merge / push diretto su `main` quando completo, Vercel deploya.
- **Migration DB**: solo additive (mai DROP/ALTER esistenti senza accordo).
- **Cache busting**: i moduli nuovi hanno `?v=8001` / `?v=8002`. Bump al cambio di modulo.
- **Test in locale**: `python3 -m http.server 8090` dalla root.
- **Memoria persistente Claude**: `~/.claude/projects/-Users-davidegentile-Documents-app-dev-gleeye-erp/memory/`.

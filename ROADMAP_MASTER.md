# Roadmap Master — Gleeye ERP

> **Cos'è questo file**: la fonte di verità di "cosa manca da fare" e "a che punto siamo". Aggiornato alla fine di ogni sessione di lavoro. **Da leggere all'inizio di ogni sessione prima di proporre la prossima mossa.**
>
> Per "cosa è già stato fatto" (storico delivered) → vedi `CHANGELOG.md`.
> Per istruzioni operative agli agenti Claude → vedi `AGENT_DIRECTIVES.md`.

**Ultimo aggiornamento**: 15 maggio 2026

---

## Stato globale — % di completamento per area

Stima onesta basata sul giro UX del 12-13 maggio (15 viste, ~85 mine identificate) + roadmap aperte in memoria.

| Area | % | Note |
|---|---|---|
| 🟢 Pricing Intelligence AI | 95% | 5 fasi live (Win/Loss, Margini, Sensitivity, Prezzi Ottimali, Lost Deal Recovery) |
| 🟢 Bank Orphans (CA-8) | 95% | AI suggest singolo live + cron 09:00 |
| 🟢 CFO Virtuale | 85% | 13 feature CFO/money shipped 14-15/5, Cash Flow + P&L + Aging + DSO/DPO live |
| 🟢 Sicurezza/RLS | 80% | Audit fatto, fix continui (oggi RLS Paolo) |
| 🟢 Anagrafiche (clienti, contatti, collab, fornitori, partner WL) | 70% | Mancano singole mine (vedi sotto) |
| 🟡 Accounting / Commesse / Incarichi | 65% | Mancano: auto-complete ordine, suggerimento collab, firma lettera incarico, listino versioning |
| 🟡 SAP Documentation Generator | 60% | Fase 1 live, manca UI lifecycle redesign |
| 🟡 Sales Engine | 55% | Fase 1 live, Fase 2 in costruzione (sessione parallela) |
| 🔴 PM / Workflow operativo | 30% | 17 mine identificate, 3-4 fatte. "Tutto dentro commessa" 10 mine intoccate |
| 🔴 Mobile Responsive | 15% | C'è solo `mobile-overrides.css` palliativo, design profondo mai pensato |
| 🔴 Design system unificato | 5% | Viste vecchie hanno padding/pulsanti/proporzioni casuali. Audit dedicato necessario |
| 🔴 Operation Simplicity | 0% | "Moltiplicatore di tutte le mine" — intoccato |
| 🔴 SDI elettronica nativa | 0% | Richiede accreditamento + integrazione XML |
| 🔴 Ricongiungimenti bancari automatici (Open Banking) | 10% | Bank orphans singolo c'è, mancano import PSD2 + match massivo |
| 🔴 Reportistica AI | 0% | Mollata per costi NotebookLM, ora riprendibile con Gemini Flash Lite |
| 🔴 Email integration (auto-import passive da inbox) | 0% | Roadmap aperta, serve provider scelta + DNS MX |
| ⚪ Booking | n/a | App separata, già live e funzionante via iframe |

**Stima totale**: ~55% del giro UX completo. **Sbilanciato verso amministrazione/CFO**, indietro su mobile/design/PM/simplicity.

---

## 🟥 Blocchi grandi non coperti (zone strutturali)

### 1. SDI elettronica nativa
**Cosa**: emettere fatture attive direttamente dall'app verso SDI (eliminando doppio lavoro Aruba) + ricezione fatture passive in app (oggi vanno dal commercialista).
**Costo stimato**: 3-5 settimane sviluppo + accreditamento SDI (variabile, 2-4 settimane).
**Bloccanti**: scelta provider intermediario (candidati: Aruba Pubblico vs Italia Software vs AssoSoftware vs Fatture in Cloud API).
**Impact**: ALTISSIMO. Elimina ~2h/settimana di doppio lavoro fiscale + chiude il cerchio fatturazione end-to-end.
**Prossimo step**: decidere provider con Davide + commercialista, poi POC integrazione XML.

### 2. Ricongiungimenti bancari automatici
**Cosa**: import automatico bonifici via PSD2 (oggi manuale da sito banca) + matching massivo "trovo 20 movimenti, ti propongo 18 link a fatture con confidence > 85%, applica con un click".
**Costo stimato**: 2-3 settimane + provider PSD2.
**Bloccanti**: scelta provider (TINK / Yapily / GoCardless / Fabrick) + credenziali Open Banking.
**Impact**: ALTO. Davide oggi 30-60min/settimana per import + match manuale. Diventa zero.
**Già fatto**: bank_orphans con AI suggest singolo (CA-8). Manca il batch.

### 3. Reportistica AI
**Cosa**: report periodici (settimanali, mensili) generati da AI: "ecco cosa è successo lunedì-venerdì in agenzia". Voice-memo input opzionale (Davide registra, AI struttura).
**Costo stimato**: 1-2 settimane.
**Bloccanti**: nessuno (costo AI ora ~€0.001 a report con Gemini Flash Lite).
**Impact**: MEDIO. Strumento per "controllare senza essere sempre dentro".
**Storico**: era stata mollata quando si pensava di usare NotebookLM (costoso). Ora riprendibile.

### 4. Mobile responsive profondo
**Cosa**: refactor di tutte le viste principali per essere mobile-first (oggi è desktop con overrides). Lo screenshot di Paolo del 15/5 è la dimostrazione: home illeggibile su iPhone.
**Costo stimato**: 2-3 settimane (dopo design pass dedicato).
**Bloccanti**: design system non definito.
**Impact**: ALTISSIMO. I collab usano molto da mobile. Senza questo, l'adozione team non scala.
**Prossimo step**: sessione design dedicata (prompt in `AGENT_DIRECTIVES.md`).

### 5. Operation Simplicity
**Cosa**: 7 principi trasversali per semplificare l'uso quotidiano dell'app:
- Progressive Disclosure
- Default Intelligenti
- Cmd+K conversational esteso
- Inbox Today (homepage minimale "che devo fare oggi")
- Novice/Expert mode
- Help AI in-place
- Linguaggio umano (no sigle, no jargon)
**Costo stimato**: 4-6 settimane.
**Test del successo**: "nuovo collab trova task in 5 min senza spiegazioni".
**Impact**: ALTISSIMO ma diluito (moltiplicatore delle altre mine).
**Riferimento memoria**: `roadmap_simplicity_operation.md`.

### 6. Email integration (auto-import fatture passive da inbox)
**Cosa**: agente Claude legge inbox dedicata gleeye → estrae PDF → auto-crea fattura passiva collegata al fornitore.
**Costo stimato**: 1 settimana + provider.
**Bloccanti**: scelta provider (SendGrid / Mailgun / Postmark) + DNS MX dedicato.
**Impact**: MEDIO-ALTO. Risparmio Davide 30-60min/mese.
**Riferimento memoria**: `roadmap_auto_import_fatture_passive.md`.

---

## 🟡 Singole mine mancanti (dal giro UX)

### Anagrafiche
- Scheda referente full (CRUD da UI, oggi è scheletrica)
- Vendor scorecard performance per partner WL
- Performance collab dashboard (cosa ha fatto, su che commesse, quanto guadagnato)
- Cliente con multipli ruoli (cliente + fornitore + partner WL stessa entità giuridica)
- Detect e merge clienti duplicati
- Tab Disponibilità collab (sotto-usata, 3/28 collab la usano)

### Ordini / Commesse / Incarichi
- Suggerimento collab giusto in assignment wizard (oggi scegli prima collab, poi servizio — invertire o suggerire)
- Firma digitale lettera incarico (Mina C)
- Auto-completamento ordine (cascade quando tutti assignments completati + tutte invoices saldate)
- Listino versioning + sconto cliente (Davide aveva detto "delicato")
- Effective margin dashboard aggregato (multi-commessa)
- Hub operativo collab nell'incarico (parzialmente fatto, mina D)

### PM
- PM-2 sistema reminder/promemoria task (schema + cron)
- Parsing strutturato @mention nei commenti PM (oggi notifica tutti gli assegnatari)
- Auto-archive pm_space quando commessa completata (verificare se già nel cascade del 14/5)
- "Tutto dentro commessa" 10 mine specifiche (sub-set del giro PM)
- File manager interno (oggi tutto su Google Drive esterno)

### Sales
- Sales Engine Fase 2 completamento (sessione parallela in corso)
- Catalogo SAP pubblico via form (Davide ha detto: arriverà quando attiveremo SAP)
- Lead enrichment AI
- Lead scoring
- Drip campaign automatica

### Accounting / Cassa
- CO-9 Solleciti scoped (Italia: scadenze imposte dai clienti)
- Bollo virtuale automatico (Davide ha detto: niente, scelta consapevole)
- Detect anomalie reverse (cliente ha pagato senza che noi abbiamo fatturato = nero)
- Dashboard cassa cumulata trimestrale/annuale

### Cmd+K (oggi 14 tool)
- Tool "manda sollecito al cliente X"
- Tool "qual è il margine effettivo della commessa Y"
- Tool "quali commesse sto perdendo soldi"
- Tool "crea preventivo per cliente Z da descrizione"

---

## 🔵 Pending architetturali / decisioni

- **Multi-tenant SaaS** — opzione architetturale (org_id day 1), non urgente
- **WIP refactor workflow stati ordine** (stashato 1 maggio 2026) — da decidere se riprendere
- **Onboarding guida nuovi utenti dalla KB** — da attivare quando arriverà la prima assunzione o richiesta
- **Notification preferences granulari per utente** — pannello esiste, integrazione email da migliorare
- **Audit log amministrazione** — Davide ha detto "non importante per ora, faccio tutto io"
- **Cleanup viste legacy/zombie** (white_label_partners.js duplica collaborators.js, ecc.)

---

## ⚫ Cose volutamente non coperte / decisioni prese

- **Audit log amministrazione** — out of scope per ora
- **Reportistica voice-memo** — riprendibile ora con Gemini (sezione blocco grande #3 sopra)
- **Booking integrazione** — resta app separata fino ad attivazione catalogo SAP pubblico
- **Email integration** — bloccata su scelta provider
- **Aspetto del banner "Journal's View"** — Davide 15/5: lasciare così intenzionalmente

---

## 📋 Come usare questo file (per Claude e per Davide)

**All'inizio di ogni sessione Claude**:
1. Leggi questo file
2. Identifica le 3 mosse a max ROI considerando: urgenza × impact × effort
3. Proponi a Davide le 3 opzioni con razionale, NON partire da solo

**Alla fine di ogni sessione Claude**:
1. Aggiorna le % delle aree toccate
2. Sposta le mine fatte dalla sezione "🟡 mancanti" al `CHANGELOG.md`
3. Aggiungi nuove mine identificate durante la sessione

**Per Davide**: questo file è il "menù" da cui ti propongo le cose. Se vedi che manca qualcosa che ricordi tu, aggiungilo o segnalamelo — è normale che la memoria sia incompleta.

---

## 🗓 Update log

- **15 maggio 2026** (sera): creato. Inventario iniziale post-sessione "CFO + risk detection". Davide ha richiamato attenzione su 3 cose dimenticate: SDI elettronica, ricongiungimenti bancari automatici, reportistica AI. Aggiunte qui come blocchi grandi.

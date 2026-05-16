# Direttive operative agli agenti Claude — Gleeye ERP

**Leggi questo file all'inizio di ogni sessione.** Si applica a tutte le sessioni Claude che lavorano su questo repo.

---

## ⚠️ STATO ATTUALE (aggiornato 16/5/2026)

### Vercel deploy: AUTO-DEPLOY DISABILITATO (scelta intenzionale)

Il deploy automatico su push a main è disabilitato per evitare di bruciare la quota giornaliera Vercel (100 deploy/day piano free).

- **`vercel.json`** ha `git.deploymentEnabled.main: false` — NON cambiarlo senza che Davide lo chieda esplicitamente.
- **Push a main**: continua normalmente. Il commit arriva, il deploy NON parte automaticamente.

### Se Davide chiede di deployare in produzione:
1. Esegui `vercel --prod` dalla root del repo (CLI Vercel, non push)
2. Oppure digli: "Deploy manuale: esegui `vercel --prod` nel terminale"
3. **NON** aprire browser, NON cercare alternative, NON toccare `vercel.json`

### Test locale: l'unica fonte di verità
- Dev server Python su `http://localhost:8090` → avviato dalla root: `python3 -m http.server 8090`
- Dopo ogni modifica pushata: di' solo "fatto — hard refresh (`Cmd+Shift+R`)"
- Niente menzioni a Vercel/production a meno che Davide non chieda esplicitamente di deployare

---

## Modello di collaborazione con Davide

**Davide non è un developer.** Non sa cosa sono branch, merge, worktree, porte, TypeScript errors, edge functions. Non deve saperlo.

- Lui esprime funzionalità, obiettivi, desideri in linguaggio naturale
- Tu traduci in codice e azioni tecniche, senza coinvolgerlo
- Se devi prendere una decisione tecnica, prendila tu — non chiedere a lui
- Se serve una sua decisione, presentagliela come scelta di prodotto ("preferisci che il bottone apra un modal o una pagina nuova?"), mai come scelta tecnica
- Non spiegare mai cosa hai fatto in termini tecnici — di' solo cosa cambia per l'utente
- **Prima di iniziare qualsiasi sessione su questo progetto**: chiedi a Davide se c'è già un'altra sessione Claude aperta su questo repo

### Roadmap come fonte di verità

`ROADMAP_MASTER.md` è il documento vivo. Ogni sessione:
1. Lo legge all'inizio per capire dove siamo
2. Lo aggiorna alla fine con le decisioni prese e le feature completate
Se una decisione non è scritta nella roadmap, non esiste.

---

## Modello operativo (sempre)

### Modello AI

- **USA SOLO** `google/gemini-2.5-flash-lite` per ogni nuova feature, default centrale.
- **NON modificare `js/modules/ai_client.js`** mai. Se ti serve un modello diverso per UNA chiamata, passa `model:` esplicito nell'opts della singola call. Non toccare `AI_MODELS` globale.
- Niente Claude Sonnet, niente Anthropic key — tutto via OpenRouter.

### File caldi (zona di rischio merge tra sessioni parallele)

NON toccare se non strettamente necessario:

- `js/modules/ai_client.js`
- `js/app.js`
- `js/modules/router.js` (solo aggiunte in append nel `switch`, mai rimozioni)
- `index.html` (solo aggiunte `<script>` in fondo)
- `js/features/cmd_palette.js`
- `js/features/orders.js` (file mostro, file caldo)
- `js/features/invoices.js`
- `js/features/clients.js`
- `js/features/collaborators.js`
- `js/features/assignments.js`
- `js/features/my_assignments.js`
- `js/features/homepage-alt.js` / `homepage.js`

### File / cartelle greenfield (zona safe)

- `js/features/<nuova-area>/*` (cartella dedicata per la feature)
- `js/modules/<nuovo-modulo>.js`
- `supabase/functions/<nuova-edge-function>/`
- `supabase/migrations/<nuovo-timestamp>_*.sql` (solo additive)

### Workflow per i merge

1. **Branch isolato per ogni feature**: `feature/<nome-feature>`
2. **Merge in main** via `git fetch origin main && git rebase origin/main && git push origin HEAD:main` quando finito.
3. **Conflitti su `ai_client.js`**: se appare, vince SEMPRE la versione `gemini-2.5-flash-lite` (mai sovrascrivere con Sonnet).
4. **Migration DB**: solo additive. Mai `DROP`/`ALTER` su tabelle esistenti senza accordo.

### ⚠️ Tre regole per evitare collisioni tra sessioni parallele

(Imparate sulla pelle il 14/5/26 — una sessione che lavorava nel repo principale ha sovrascritto cache-bust di `?v=8003` riportandolo a `?v=8000`, e ha bloccato un merge con WIP non committato.)

1. **Lavora SEMPRE in un worktree dedicato**, mai nel repo principale (`/Users/davidegentile/Documents/app dev/gleeye erp/`). Il repo principale è "shared" — lo usa Davide per testare via localhost:8090 e altre sessioni potrebbero esserci dentro. Crea il tuo worktree con `git worktree add .claude/worktrees/<nome> -b feature/<feature>` e lavora SOLO lì.

2. **Prima di ogni push** fai sempre `git fetch origin main && git rebase origin/main`. Se ci sono conflitti su file caldi (vedi lista sopra), **non risolverli da solo**: o aspetti che l'altra sessione finisca, o chiedi a Davide. Mai un merge ciecone con `--no-edit`.

3. **Le versioni `?v=XXXX` negli import (`import('./foo.js?v=8000')`) sono cache-bust del browser**, non scegliere numeri a caso. Se devi forzare un reload, bumpa solo l'ultima cifra (`8000` → `8001` → ...). MAI abbassare. Se trovi conflitti su questi numeri durante un rebase: vince sempre il numero PIÙ ALTO.

### Workflow localhost:8090 + worktree (per non far impazzire Davide)

- Il `python3 -m http.server 8090` di Davide gira dalla root del repo principale. Serve il working tree di quel path.
- Se vuoi che Davide veda le tue modifiche su localhost, dopo aver pushato a `origin/main`:
  1. Dal repo principale: `git checkout origin/main -- <files_che_hai_modificato>` (NON `git pull`, eviti merge con WIP altrui).
  2. Bumpa `?v=` se hai toccato file caldi, così il browser cache invalida.
- Se trovi WIP non committato di un'altra sessione nel repo principale: NON ci toccare, stasha solo se necessario e poppa dopo.

### Testing

- Test syntactic locale: `node --check <file>` dopo ogni modifica JS.
- Test funzionale: il check finale lo fa Davide via `localhost:8090`. **Non promettere "live in produzione"** finché Vercel non riapre.

---

## Memoria persistente

`~/.claude/projects/-Users-davidegentile-Documents-app-dev-gleeye-erp/memory/` — leggi all'inizio di ogni sessione. Contiene il giro UX completo, le roadmap aperte, il piano operativo master, il quaderno anomalie.

## Roadmap master (FONTE DI VERITÀ di "cosa manca")

`ROADMAP_MASTER.md` (root del repo) — leggi all'inizio di OGNI sessione PRIMA di proporre la prossima mossa. Contiene:
- % di completamento per area
- Blocchi grandi non coperti (SDI, Open Banking, Reportistica, Mobile/Design, Simplicity, Email)
- Singole mine mancanti dal giro UX
- Pending architetturali

Da aggiornare alla fine di ogni sessione: muovi le mine fatte da "mancanti" al CHANGELOG, aggiorna le %, aggiungi nuove mine emerse.

## Changelog operativo

`CHANGELOG.md` (root del repo) — aperto da Davide come "manuale". Aggiornalo quando completi una feature visibile all'utente finale.

## Sessione design dedicata

Per il "design pass + audit UX" — vedi prompt completo conservato nella memoria di Davide. Crea un worktree dedicato `feature/design-pass-2026-05`, output solo file markdown (`DESIGN_AUDIT.md` + `DESIGN_SYSTEM_PROPOSAL.md`), nessun refactor in prima sessione.

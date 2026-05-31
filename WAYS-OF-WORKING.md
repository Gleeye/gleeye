# Ways of Working — il pattern "Regia + Sessioni"
*Metodo per organizzare il lavoro multi-sessione su Claude Code senza scontri. Portabile in qualunque
progetto: copia questo file + la riga in CLAUDE.md.*

## Il problema che risolve
Più sessioni Claude in parallelo, ognuna che si crede padrona di tutto → mettono le mani sugli stessi
file, si scontrano al merge, bruciano token, i risultati tardano. **Causa: nessuno possiede il "core
condiviso" e nessuno tiene la mappa.**

## Regola critica per Gleeye

**Il branch di produzione Vercel è `main`.**
Tutte le sessioni verticali lavorano su `deploy/non-sales-features`, ma la REGIA fa merge su `main` dopo ogni gruppo di fix. Senza questo merge, niente va live.

Flusso corretto:
1. Verticali → commit su `deploy/non-sales-features`
2. REGIA → merge `deploy/non-sales-features` → `main` → push
3. Vercel deploya automaticamente da `main`

## Le 6 regole

1. **MACRO = regia.** Una sessione (la principale) NON scrive codice di feature. Tiene la visione,
   **possiede il core condiviso**, e tiene **l'indice** di dove sta tutto. È il direttore d'orchestra.

2. **VERTICALI vs ORIZZONTALI.**
   - *Verticali* = costruiscono UNA feature/modulo (indipendenti tra loro).
   - *Orizzontali* = tracce trasversali che governano TUTTO (design system, sicurezza, data model, infra,
     business). Distinguerle elimina metà degli scontri: l'UX o la sicurezza non "appartengono" a una feature.

3. **Il CORE CONDIVISO ha UN proprietario: il macro.** Data model / tipi, design token, componenti base,
   schema DB. Le verticali costruiscono *sopra* il core, **non lo riscrivono**. ← la regola che evita gli scontri.

4. **Ogni sessione parte da un BRIEF autosufficiente** (un doc nel repo). Si apre "a freddo" con tutto il
   contesto (cos'è, file coinvolti, scope, cosa NON toccare, angoli ciechi). Niente "ti spiego dov'eravamo".

5. **UN INDICE unico = la verità.** Un file (o memoria) con la mappa di tutte le sessioni e di chi possiede
   cosa. Se non ricordi nulla, riparti da lì.

6. **Spawn → parallelo → ricuci.** Spingi il lavoro profondo in sessioni dedicate (worktree separato).
   Lavorano in parallelo. Il macro **ricuce** e tiene la coerenza del core.

## Come opera il MACRO (la sessione regia)
- Non si tuffa nel dettaglio di un tool: quando una cosa diventa profonda, **scrive il brief e la apre in
  sessione** invece di farla qui.
- Custodisce e aggiorna l'**indice**; possiede i file del **core condiviso**.
- Quando una sessione tocca un file condiviso, il macro tiene la coerenza (è lui il punto di verità).
- Fa nascere le idee, dà la visione d'insieme, decide l'ordine.

## Checklist per aprire una sessione
1. Scrivi un **brief** `SPEC-<nome>.md` autosufficiente (scope, file, cosa NON toccare, angoli ciechi).
2. Apri la sessione puntando al brief (worktree dedicato).
3. Aggiungi una riga all'**indice** (cosa fa, è verticale o orizzontale, chi possiede cosa).

## Onestà / limiti
- Non è automatico: regge **finché il macro fa rispettare la proprietà del core**. Se le verticali editano
  liberamente i file condivisi, gli scontri tornano.
- Funziona meglio dove il lavoro **si decompone** in verticali quasi indipendenti + poche orizzontali.
  Non tutti i progetti si tagliano così bene — in quel caso, meno parallelo, più sequenziale.

## Primo prompt al macro (in un progetto nuovo)
> "Fai la REGIA: non scrivere codice di feature. Possiedi il core condiviso e l'indice. Distingui
> verticali da orizzontali. Quando una cosa diventa profonda, scrivimi un brief autosufficiente e
> aprila in sessione dedicata. Tieni tu la mappa."

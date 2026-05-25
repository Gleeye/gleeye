# Checklist testing — sessione 21/5/26

9 mine implementate. Segui in ordine. Metti `[V]` quando OK, `[X]` se KO + nota.

> **Preliminare**: hard reload (`CMD+Shift+R` o `CTRL+F5`) per scaricare i nuovi JS. Su PWA iOS: chiudi e riapri la web-app.

---

## 1. Mina 6 Step 4 — Bozza email "Lavori conclusi"

**Setup**: serve almeno un ordine con `status_works=completato` e `client_id` valido.

- [sulle mail dobbiamo fare un lungo discorso ] Apri sidebar → **Amministrazione → Comunicazioni → Bozze Email**
- [ ] La vista carica senza errori
- [ ] Se già esistono bozze: vedi card con cliente + numero ordine + email destinatario
- [ ] Filtri chip in alto funzionano: Bozze / Inviate / Errore / Scartate / Tutte
- [ ] Click su "Apri" → modal con destinatario, oggetto, body HTML modificabili
- [ ] Bottone "Anteprima" toggla tra textarea HTML e preview renderizzata
- [ ] **Genera una bozza vera**: vai su una commessa, cambia `status_works` da "In svolgimento" → "Completato" → torna in #outbound-emails → bozza nuova appare
- [ ] Click "Salva bozza" → modifiche persistono
- [ ] Click "Invia ora" → conferma → email parte (controlla la casella del cliente di test) → bozza passa a "Inviata"
- [ ] Click "Scarta" su una bozza → passa a "Scartate"
- [ ] Sull'admin dashboard → tab Settings → in alto vedi card "N bozze email da inviare" (se ci sono draft)

---

## 2. Mina 6 Step 6 — NPS magic-link

**Setup**: serve un ordine con `status_works=completato`.

- [V] Apri detail di una commessa chiusa
- [V] Card **"Feedback cliente"** appare sotto "Da fatturare" / "Preventivo"
- [V] Se nessuna survey ancora: bottone "Chiedi feedback NPS"
- [ non succede nulla se clicco ] Click bottone → prompt email destinatario (default email cliente) → conferma
- [ ] Email arriva al destinatario con link `/nps.html?token=...`
- [ ] Apri il link: pagina pubblica con scala 0-10 + commento
- [ ] Seleziona uno score, scrivi commento, clicca "Invia feedback"
- [ ] Pagina mostra "Grazie!" + frase contestuale (promoter/passive/detractor)
- [ ] Torna alla commessa → card "Feedback cliente" ora mostra score colorato + commento
- [ ] Riapri lo stesso link → mostra "Hai già inviato il feedback" (idempotenza)

---

## 3. CO-2 — Card Fatturazione potenziata

- [V ] Apri detail di una commessa con `price_final > 0`
- [ V] Card **"Fatturazione"** (era "Da Fatturare") presente
- [V] **Barra coverage** colorata: rossa se <50%, blu se 50-99%, verde se 100%
- [V ] Sotto la barra: "Fatturato X€ su Y€" + "Residuo Z€" se non tutto fatturato
- [V ] Se ci sono fatture: lista compatta con numero, data, importo, badge stato
- [ V] **Click su una riga fattura** → apre detail fattura
- [V] Hover: riga si illumina (background cambia)
- [V] Se commessa "completato" ma non tutto fatturato: badge giallo **"Da chiudere"**
- [V] Se 100% fatturato: card verde con badge **"Tutto fatturato"**, NIENTE bottone "Genera fattura"
- [ si però è concettualmente sbagliato la fattura saldo cioè tipo sono in un ordine a rate...] Se manca da fatturare: bottone verde "Genera fattura saldo X€"

---

## 4. Subscription tracker — dashboard cash-out

- [non ho capito perché sta cosa l'hai messa in questa vista e non nella parte di amministrazione della società, questa è l'area amministrazione tecnica dell'app] Apri **Amministrazione** (tab Settings)
- [v] In alto, dopo le card KPI, vedi il widget viola **"Cash-out abbonamenti"**
- [v] 2 box: "Costo annuo" + "Costo mensile" (oggi dovresti vedere ~648€/anno - Dropbox)
- [v] Sezione "Distribuzione per categoria" con barre orizzontali
- [v] Sezione "Top 5 per costo annuo": Dropbox dovrebbe essere lì con badge **"Inattivo"** (nessuna fattura ricevuta 6m+)
- [v] Banner arancione: "1 abbonamento senza fattura ricevuta da 6+ mesi · Potenziale risparmio 648€/anno"
- [v] Link "Gestisci fornitori →" in basso porta a `#suppliers`

> **Per testarlo bene**: vai in #suppliers, aggiungi qualche subscription a fornitori esistenti (es. ChatGPT, Vercel, ecc.) con importo + frequenza. Torna sull'admin dashboard → vedi totali aggiornati.

---

## 5. Mina A — Auto status_works=completato

**Test sicuro (in browser)**:

- [ prova a fare un test tu con commessa nuova, non voglio toccare le attuali] Trova una commessa con TUTTI gli assignment in stati intermedi (almeno 1 "In Corso")
- [ ] Apri il detail di quell'assignment "In Corso"
- [ ] Cambia status a "Completato"
- [ ] Torna alla commessa → `status_works` deve essere passato a **"completato"** automaticamente
- [ ] Si crea la **bozza email "Lavori conclusi"** (verifica in #outbound-emails)
- [ ] Si creano task **"Valuta performance: [collab]"** per ogni collab (verifica in Le mie task)
- [ ] Si crea task **"Ricontatta cliente X (commessa Y completata)"** con scadenza +90gg

**Opt-out test** (opzionale):
- [ ] Su una commessa speciale: tramite SQL `UPDATE orders SET disable_auto_complete=true WHERE id='...';` 
- [ ] Completi tutti gli assignment → la commessa **NON** passa automaticamente
- [ ] Dimmi se serve UI per il toggle (oggi è solo SQL)

---

## 6. Mina E — Briefing AI assignment

**Setup**: serve essere loggato come collab (o impersonare un collab) per vedere la vista collab.

- [v] Impersona un collaboratore (icona admin → impersona)
- [v] Vai sui tuoi incarichi (`#my-assignments`) → click su uno per aprire il detail
- [v] Sotto la card "Cosa devi fare" → nuova card viola **"Briefing AI"**
- [v] Bottone "Genera briefing AI"
- [v] Click → spinner "L'AI sta scrivendo il briefing…" per qualche secondo
- [ se lo è inventato,completamente allucinato] Appare il brief in markdown: 1 frase sintesi + 3-5 punti operativi + insidie/cose da chiedere all'account
- [v] Bottone "Rigenera" in basso a destra
- [v] Click "Rigenera" → spinner → nuovo brief
- [v] Esci e rientra sulla pagina → brief ancora visibile (cached 24h)
- [v] Dopo 24h: badge "Aggiorna (cache scaduta)" sul bottone

---

## 7. BK-4 — Reminder booking 24h

**Test in modo "naturale"**:
- [prova a farlo tu se riesci ] Crea (o trova) un booking con `start_time` ESATTAMENTE tra 23-25 ore da adesso
- [ ] Aspetta l'esecuzione del cron (minuto :05 dell'ora successiva)
- [ ] L'email arriva al cliente con "Promemoria: appuntamento domani alle X"
- [ ] In DB: `bookings.reminder_sent_at_24h` ora valorizzato

**Test forzato (SQL)**:
- [ ] Esegui manualmente: `SELECT public.fn_send_booking_24h_reminders();`
- [ ] Output `{processed: N, errors: 0}` 
- [ ] Se N=0 è normale (nessun booking in finestra)

---

## Bug fix bonus da verificare

- [ ] Crea/modifica una commessa con `account_id` valido (utente esistente) → cambia in completato → bozza email creata regolarmente
- [ ] Su una commessa "vecchia" con `account_id` puntante a utente cancellato → cambia in completato → bozza email creata con `from_user_id=NULL` ma `from_name`/`from_email` snapshot OK (nessun errore in console)

---

## Quando hai finito

Rispondi indicando cosa è OK (V) e cosa è KO (X) con nota. Le cose KO le aggiusto subito.

Per cose da migliorare o nuove idee emerse: scrivile separate, le valutiamo dopo i fix.

# Testing Sessione 20/5/26 — Guida operativa

Scaletta da eseguire **in locale** (worktree principale, branch `deploy/non-sales-features`)
prima di pushare su Vercel. 17 commit pendenti push, 19 migration GIÀ LIVE su prod.

**Tempo stimato totale**: 30–45 min. Spunta i ✅ man mano. Se trovi un bug,
appuntalo a fondo pagina con: vista, cosa hai fatto, cosa è successo, cosa
ti aspettavi.

---

## 0. Setup test

- [ ] `npm start` (o equivalente) per dev server in locale
- [ ] Apri l'app loggato come **te stesso** (admin/partner, vede tutto)
- [ ] In secondo tab, tieni aperta la console browser per intercettare errori JS

---

## 1. #sales — Clienti (commit d8ea08e + f9a56ff + 20fa34a + f5fca0e)

- [V] Naviga a `#sales`
- [V (però voglio che mi spieghi le differenze tra i vari stati nell'interfaccia magari un ? con modal che si espande se ci vado sopra)] **6 chip stato** visibili nella sidebar: "Tutti 83 / Lead 41 / Potenziali 5 / Attivi 11 / Dormienti 15 / Persi 11"
- [V] Clicca chip "Lead" → la lista mostra **solo** clienti senza ordini
- [V] Clicca chip "Tutti" → torna alla lista completa
- [V] **Select account**: deve includere "👤 I miei clienti (N)" se hai un collaborator_id collegato
- [V] Selezionando "I miei" filtra dove `account_responsible_id = tuo collab`
- [V] **Combinazione**: chip Attivi + select "I miei" → solo i tuoi clienti attivi
- [V] Badge stato colorato visibile su ogni card della lista
- [si ma io ho la fotina ad esempio, voglio quella nel caso...] Avatar account responsabile (cerchio colorato con iniziali) visibile su ogni card

## 2. #client-detail — Dettaglio cliente (d2f62ea + 20fa34a + f5fca0e)

- [V] Apri un cliente attivo (es. quello con più ordini)
- [V] **Header**: vedi badge stato + badge last_touch "X giorni fa" colorato (verde se <30gg, ambra <90gg, grigio oltre)
- [V] **Tab Panoramica**: se il cliente ha note, vedi la card gialla "Note sul cliente"
- [è buggata la notifica che arriva dice che ho cambiato la partita iva la notifica che mi è arrivata ] Modifica il cliente → tab Note nel modal: scrivi qualcosa → salva → torna in detail → vedi card gialla con il testo
- [V] **Tab Referenti** (sostituisce il messaggio "in DB"):
  - [V] Mostra count "N referenti" + bottone "+ Aggiungi referente"
  - [V] Clicca "+ Aggiungi referente" → si apre modal con campi nome/cognome/ruolo/email/phone/mobile
  - [V] Nel campo Ruolo: digita una lettera → vedi datalist con 7 suggerimenti (Direzione/CEO, Marketing, Comunicazione, Amministrazione, Tecnico, Vendite, Altro)
  - [V] Salva → modal si chiude, vedi la nuova card
  - [V] Clicca su una card esistente → si apre il modal in edit mode + bottone "Elimina" rosso visibile
  - [V] Click "Elimina" → conferma → la card sparisce

## 3. #employees — Collaboratori (d4c8312 + ca9df68 + 300ecde)

- [v] Naviga a `#employees`
- [v si ma ora c'è un doppio tag e poi anche qui voglio il ? con il modal che spiega] **Badge lifecycle** accanto all'avatar di ogni collab attivo (Attivo verde / Dormiente grigio / Candidato blu)
- [V si ma tutto su una riga fa schifo, però vabbè del design ora non me ne voglio occupare] **Pills container**: dopo i reparti vedi i nuovi chip lifecycle "Tutti 28 / Attivi 18 / Dormienti 5 / Candidati 3"
- [V] Clicca "Dormienti" → vedi solo collab dormienti (nessun assignment recente)
- [V] Combinazione: chip reparto "Foto" + chip lifecycle "Attivi" → intersection
- [ ] Apri un collab dormiente:
  - [ah ok allora è voluto il doppio badge... l'anagrafico se fai bene il lifecycle a sto punto non serve più ] Header mostra 2 badge: "Attivo" anagrafico + "Dormiente" lifecycle
  - [V] Card "Note" gialla se popolata
- [V] Modifica un collab → sezione "Note" con textarea → scrivi → salva → ricarica detail → card visibile

## 4. #white-label-partners — Partner WL (3e711cb)

- [V] Naviga a `#white-label-partners`
- [V] Badge lifecycle visibile sulla card di Aquilia e Btwo (probabilmente entrambi "Dormiente" o "Attivo" a seconda dell'attività recente)

## 5. #contacts — Referenti standalone (dfd626a)

- [ non trovata nella sidebar è sparita o almeno non è in Amministrazione > Anagrafiche ] Naviga a `#contacts`
- [ ] Bottone "+ Nuovo referente" in alto a destra
- [ ] 4 chip filtro "Tutti N / Clienti / Partner WL / Fornitori"
- [ ] Clicca "+ Nuovo referente" → modal picker cliente con search-live (digita 3 caratteri → si filtra)
- [ ] Seleziona un cliente → si apre il modal aggiungi referente
- [ ] Click su una card esistente di un client contact → si apre modal in edit mode
- [ ] **Card hanno badge colorato del relation_type** (Cliente blu / Partner WL viola / Fornitore ambra)

## 6. #assignments — Incarichi (2447996)

- [v] Naviga a `#assignments`
- [non funziona benissimo] Se sei privileged (partner/admin) con collaborator_id: vedi toggle "👤 I miei" prima delle pills stato
- [v] Click "I miei" → mostra solo gli incarichi dove sei account o collab dell'ordine

## 7. #dashboard — Ordini (0bbd5fd)

- [V] Naviga a `#dashboard`
- [V] Nella filter bar (Anno/Cliente/Stato), vedi anche toggle "👤 I miei" / "👥 Tutti" (se privileged)
- [V] Click "I miei" → ordini filtrati per account_id/pm_id/coinvolto = tuo collab

## 8. #suppliers — Fornitori (08ed7e0 + 7d97464 + 6472947)

- [V] Naviga a `#suppliers`
- [ V ] Sotto il segmented Attivi/Archiviati vedi 9 chip filtro categoria (Software/Hosting/Professionali/...)
- [V] Click "👤 Persone fisiche" → solo i 4 individui
- [V] Apri/Modifica un supplier (es. Adobe):
  - [V] Nuovi campi visibili: Categoria, Sotto-categoria, checkbox Persona fisica
  - [V] Sotto "Indirizzo & Contatti" vedi nuova sezione "Abbonamento (se ricorrente)" con Importo / Frequenza / Prossimo rinnovo
  - [V] Imposta Categoria=Software/SaaS + Subcategory=Design + Abbonamento €60 / Mensile / Rinnovo 25/05/2026
  - [V] Salva → riapri → i valori sono persistiti
- [V] Verifica `accounting_category` ereditata: SQL `SELECT supplier_name, accounting_category FROM passive_invoices WHERE supplier_id = (SELECT id FROM suppliers WHERE name ILIKE '%adobe%') LIMIT 5`

## 9. PM hub_drawer — Promemoria (be42a41)

- [V] Apri una commessa (#pm/commessa/X) o area interna
- [V] Clicca su una task per aprire il hub_drawer
- [V] **Dopo il blocco metadata** (Inizio/Scadenza/Priorità/Stato) vedi nuova riga full-width "PROMEMORIA" con icona campanella
- [v] Imposta un reminder per **2 minuti nel futuro** via input datetime-local (non oggi a 00:00 — esplicito orario)
- [v] Vedi badge "in attesa" giallo accanto
- [v] Cambia/rimuovi → comportamento corretto, bottone "Rimuovi" appare solo quando impostato

**Test cron 5 min**: aspetta 5-7 min, riapri la task → dovresti vedere badge "✓ inviato …" e una notifica nel pannello web

**Test SQL cascade**: marca una commessa di test a `status_works=completato` via UI o SQL:
```sql
-- Trova una commessa innocua
SELECT id, order_number, title FROM orders WHERE status_works != 'completato' ORDER BY created_at DESC LIMIT 5;
-- Falla completata
UPDATE orders SET status_works='completato' WHERE id='<id-test>';
-- Verifica cascata
SELECT title FROM pm_items WHERE space_ref = (SELECT id FROM pm_spaces WHERE ref_ordine='<id-test>') AND created_at > NOW() - INTERVAL '1 minute';
-- Dovresti vedere: "Ricontatta cliente..." + "Valuta performance: ..." per ogni collab
SELECT type, title FROM notifications WHERE data->>'order_id' = '<id-test>' AND created_at > NOW() - INTERVAL '1 minute';
-- Dovresti vedere: order_completed + order_completed_pending_assignments (se ci sono pending)
```

## 10. Test trigger lifecycle / stato cliente

```sql
-- Crea un test client lead
INSERT INTO clients (business_name, client_code) VALUES ('TEST CLIENTE BUG', 'T-BUG-001');
-- Verifica status_derived
SELECT business_name, status_derived FROM clients WHERE client_code='T-BUG-001';
-- Aspettati: 'lead'

-- Crea un order accettato per quel client
INSERT INTO orders (client_id, order_number, title, offer_status, status_works)
SELECT id, 'TEST-001', 'Test', 'accettata', 'in_svolgimento'
  FROM clients WHERE client_code='T-BUG-001';
-- Verifica
SELECT business_name, status_derived, last_touch_at FROM clients WHERE client_code='T-BUG-001';
-- Aspettati: status_derived='attivo' + last_touch_at appena bumped

-- Cleanup
DELETE FROM orders WHERE order_number='TEST-001';
DELETE FROM clients WHERE client_code='T-BUG-001';
```

## 11. Verifica advisor sicurezza

Dopo tutte le migration, controlla che gli advisor non abbiano regredito:
- ERROR `rls_disabled_in_public` → dev'essere risolto
- WARN sulle mie 4 trigger fn → tutte REVOKE da authenticated/anon

---

## Bug trovati

| # | Vista | Cosa hai fatto | Cosa è successo | Atteso |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

---

## Quando hai finito

Se tutto OK → `git push origin deploy/non-sales-features` (Vercel deploya in 2 min).

Se trovi bug → segna sopra + dimmi via chat: "bug #N", e fixiamo a sessione di-mirata, NON in flow.

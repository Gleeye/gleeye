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

- [ ] Naviga a `#sales`
- [ ] **6 chip stato** visibili nella sidebar: "Tutti 83 / Lead 41 / Potenziali 5 / Attivi 11 / Dormienti 15 / Persi 11"
- [ ] Clicca chip "Lead" → la lista mostra **solo** clienti senza ordini
- [ ] Clicca chip "Tutti" → torna alla lista completa
- [ ] **Select account**: deve includere "👤 I miei clienti (N)" se hai un collaborator_id collegato
- [ ] Selezionando "I miei" filtra dove `account_responsible_id = tuo collab`
- [ ] **Combinazione**: chip Attivi + select "I miei" → solo i tuoi clienti attivi
- [ ] Badge stato colorato visibile su ogni card della lista
- [ ] Avatar account responsabile (cerchio colorato con iniziali) visibile su ogni card

## 2. #client-detail — Dettaglio cliente (d2f62ea + 20fa34a + f5fca0e)

- [ ] Apri un cliente attivo (es. quello con più ordini)
- [ ] **Header**: vedi badge stato + badge last_touch "X giorni fa" colorato (verde se <30gg, ambra <90gg, grigio oltre)
- [ ] **Tab Panoramica**: se il cliente ha note, vedi la card gialla "Note sul cliente"
- [ ] Modifica il cliente → tab Note nel modal: scrivi qualcosa → salva → torna in detail → vedi card gialla con il testo
- [ ] **Tab Referenti** (sostituisce il messaggio "in DB"):
  - [ ] Mostra count "N referenti" + bottone "+ Aggiungi referente"
  - [ ] Clicca "+ Aggiungi referente" → si apre modal con campi nome/cognome/ruolo/email/phone/mobile
  - [ ] Nel campo Ruolo: digita una lettera → vedi datalist con 7 suggerimenti (Direzione/CEO, Marketing, Comunicazione, Amministrazione, Tecnico, Vendite, Altro)
  - [ ] Salva → modal si chiude, vedi la nuova card
  - [ ] Clicca su una card esistente → si apre il modal in edit mode + bottone "Elimina" rosso visibile
  - [ ] Click "Elimina" → conferma → la card sparisce

## 3. #employees — Collaboratori (d4c8312 + ca9df68 + 300ecde)

- [ ] Naviga a `#employees`
- [ ] **Badge lifecycle** accanto all'avatar di ogni collab attivo (Attivo verde / Dormiente grigio / Candidato blu)
- [ ] **Pills container**: dopo i reparti vedi i nuovi chip lifecycle "Tutti 28 / Attivi 18 / Dormienti 5 / Candidati 3"
- [ ] Clicca "Dormienti" → vedi solo collab dormienti (nessun assignment recente)
- [ ] Combinazione: chip reparto "Foto" + chip lifecycle "Attivi" → intersection
- [ ] Apri un collab dormiente:
  - [ ] Header mostra 2 badge: "Attivo" anagrafico + "Dormiente" lifecycle
  - [ ] Card "Note" gialla se popolata
- [ ] Modifica un collab → sezione "Note" con textarea → scrivi → salva → ricarica detail → card visibile

## 4. #white-label-partners — Partner WL (3e711cb)

- [ ] Naviga a `#white-label-partners`
- [ ] Badge lifecycle visibile sulla card di Aquilia e Btwo (probabilmente entrambi "Dormiente" o "Attivo" a seconda dell'attività recente)

## 5. #contacts — Referenti standalone (dfd626a)

- [ ] Naviga a `#contacts`
- [ ] Bottone "+ Nuovo referente" in alto a destra
- [ ] 4 chip filtro "Tutti N / Clienti / Partner WL / Fornitori"
- [ ] Clicca "+ Nuovo referente" → modal picker cliente con search-live (digita 3 caratteri → si filtra)
- [ ] Seleziona un cliente → si apre il modal aggiungi referente
- [ ] Click su una card esistente di un client contact → si apre modal in edit mode
- [ ] **Card hanno badge colorato del relation_type** (Cliente blu / Partner WL viola / Fornitore ambra)

## 6. #assignments — Incarichi (2447996)

- [ ] Naviga a `#assignments`
- [ ] Se sei privileged (partner/admin) con collaborator_id: vedi toggle "👤 I miei" prima delle pills stato
- [ ] Click "I miei" → mostra solo gli incarichi dove sei account o collab dell'ordine

## 7. #dashboard — Ordini (0bbd5fd)

- [ ] Naviga a `#dashboard`
- [ ] Nella filter bar (Anno/Cliente/Stato), vedi anche toggle "👤 I miei" / "👥 Tutti" (se privileged)
- [ ] Click "I miei" → ordini filtrati per account_id/pm_id/coinvolto = tuo collab

## 8. #suppliers — Fornitori (08ed7e0 + 7d97464 + 6472947)

- [ ] Naviga a `#suppliers`
- [ ] Sotto il segmented Attivi/Archiviati vedi 9 chip filtro categoria (Software/Hosting/Professionali/...)
- [ ] Click "👤 Persone fisiche" → solo i 4 individui
- [ ] Apri/Modifica un supplier (es. Adobe):
  - [ ] Nuovi campi visibili: Categoria, Sotto-categoria, checkbox Persona fisica
  - [ ] Sotto "Indirizzo & Contatti" vedi nuova sezione "Abbonamento (se ricorrente)" con Importo / Frequenza / Prossimo rinnovo
  - [ ] Imposta Categoria=Software/SaaS + Subcategory=Design + Abbonamento €60 / Mensile / Rinnovo 25/05/2026
  - [ ] Salva → riapri → i valori sono persistiti
- [ ] Verifica `accounting_category` ereditata: SQL `SELECT supplier_name, accounting_category FROM passive_invoices WHERE supplier_id = (SELECT id FROM suppliers WHERE name ILIKE '%adobe%') LIMIT 5`

## 9. PM hub_drawer — Promemoria (be42a41)

- [ ] Apri una commessa (#pm/commessa/X) o area interna
- [ ] Clicca su una task per aprire il hub_drawer
- [ ] **Dopo il blocco metadata** (Inizio/Scadenza/Priorità/Stato) vedi nuova riga full-width "PROMEMORIA" con icona campanella
- [ ] Imposta un reminder per **2 minuti nel futuro** via input datetime-local (non oggi a 00:00 — esplicito orario)
- [ ] Vedi badge "in attesa" giallo accanto
- [ ] Cambia/rimuovi → comportamento corretto, bottone "Rimuovi" appare solo quando impostato

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

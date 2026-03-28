---
description: "SOP e regole complete per il sistema Activity Feed — fonte di verità per trigger SQL, helper frontend, e notifiche"
updated: "2026-03-27"
---

# Regole complete del sistema Activity Feed

Questo file è la **fonte di verità** per chiunque (umano o AI) modifichi il sistema di log delle attività. Va consultato prima di toccare `fn_app_activity_logger`, `pm_activity_registry`, `pm_activity_helper.js`, o qualsiasi vista che mostri activity feed.

---

## 1. Architettura del sistema

```
Evento DB (INSERT/UPDATE/DELETE)
        ↓
  Trigger SQL (fn_app_activity_logger)
        ↓
  Legge pm_activity_registry → genera descrizione con template
        ↓
  Inserisce riga in pm_activity_logs
        ↓
  Frontend (pm_activity_helper.js → humanizeActivity())
        ↓
  Stringa HTML renderizzata all'utente
```

### Campi chiave di `pm_activity_logs`
| Campo | Tipo | Significato |
|-------|------|-------------|
| `action_type` | TEXT | Identificatore dell'azione (es. `task_updated:status`) |
| `description` | TEXT | Testo già idrato dal trigger |
| `actor_user_ref` | UUID | Chi ha fatto l'azione (da `auth.uid()`) |
| `order_ref` | UUID | Commessa collegata |
| `space_ref` | UUID | Spazio PM collegato |
| `item_ref` | UUID | Task collegata |
| `metadata` | JSONB | `{table, diff, col, old, new}` per UPDATE granulari |

---

## 2. Bug noti e limitazioni critiche

### BUG 1: Il placeholder `{entity}` non esiste
Il trigger SQL sostituisce `{col_name}` con il valore della colonna corrispondente. Ma **`entity` non è una colonna reale** in nessuna tabella. I template che usano `{entity}` (es. `pm_spaces`, `assignments`, `pm_item_assignees`) produrranno stringhe con `{entity}` letterale nel log.

**Fix atteso:** Usare placeholder reali (`{name}`, `{title}`, `{description}`) oppure aggiungere la risoluzione di `entity` nel trigger lato frontend in `humanizeActivity()` usando `log.item?.title || log.space?.name || log.order?.title`.

### BUG 2: I valori enum non vengono tradotti dal trigger
Il trigger inserisce il valore grezzo della colonna: `{new_value}` diventa `in_progress`, non "In Corso". La traduzione avviene **solo nel frontend** via `activityVocabulary`. Se la `description` arriva già idrata dal DB, il frontend non la ritraduce.

**Fix atteso:** Il frontend in `humanizeActivity()` deve applicare `activityTranslate()` sui valori in `metadata.new` / `metadata.old`, e non fidarsi ciecamente di `log.description` quando contiene valori enum grezzi.

### BUG 3: `doc_pages` usa `{title}` ma la colonna non esiste
Il template `"ha caricato il file **{title}**"` per `doc_pages` non funziona perché la tabella non ha una colonna `title`. Il risultato sarà la stringa letterale `{title}`.

**Fix atteso:** Usare il nome colonna corretto della tabella `doc_pages` (es. `{file_name}` o `{page_name}`), oppure risolvere lato frontend.

### BUG 4: `is_notification_enabled = false` ovunque
Le notifiche push **non sono attive per nessuna tabella**. I campi `notification_template_insert` e `notification_template_update` sono NULL. Non implementare logica che dipende da notifiche automatiche senza prima attivarle nel registry.

### BUG 5: Duplicati di `action_type`
A causa di iterazioni di sviluppo successive, esistono log storici con `action_type` in formati diversi (es. `UPDATE:status`, `task_updated:status`, `status_changed`). Il frontend deve essere robusto alle variazioni usando `includes()` o una mappa di normalizzazione (vedi sezione 6).

---

## 3. Convenzione di naming per `action_type`

### Formato canonico
```
{area}_{entità}:{operazione}[:{campo}]
```

Esempi:
- `new_task` — creazione task
- `task_updated:status` — modifica status task
- `new_assignment` — creazione incarico
- `assignment_updated:budget` — modifica budget incarico

### Regole
- Tutto **lowercase** con underscore
- L'operazione base è: `new_*`, `*_updated`, `*_removed`, `*_deleted`
- Per UPDATE granulari aggiungere `:{campo}` (es. `task_updated:due_date`)
- Per tabelle di relazione (assignees, links): `new_assignment`, `assignment_removed`
- NON usare `INSERT`, `UPDATE`, `DELETE` in maiuscolo — sono i vecchi valori grezzi

---

## 4. Vocabolario di traduzione (activityVocabulary)

### Status Tasks (`pm_items.status`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `todo` | Da Fare |
| `in_progress` | In Corso |
| `blocked` | Bloccato |
| `review` | In Revisione |
| `done` | Completata |

### Status Commesse (`pm_spaces.status`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `active` | Attiva |
| `completed` | Completata |
| `on_hold` | In Pausa |
| `archived` | Archiviata |

### Status Lavori Ordine (`orders.status_works`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `da_iniziare` | Da Iniziare |
| `in_svolgimento` | In Svolgimento |
| `completato` | Completato |
| `sospeso` | Sospeso |
⚠️ Attenzione: valori storici potrebbero avere capitalizzazione mista (`In svolgimento`). Usare `LOWER()` nei confronti SQL.

### Status Offerta (`orders.offer_status`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `draft` | Bozza |
| `sent` | Inviata |
| `accepted` | Accettata |
| `rejected` | Rifiutata |

### Status Incarico (`assignments.status`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `active` | Attivo |
| `completed` | Completato |
| `cancelled` | Annullato |

### Status Fattura (`invoices.status` o simile)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `draft` | Bozza |
| `sent` | Inviata |
| `paid` | Pagata |
| `overdue` | Scaduta |
| `cancelled` | Annullata |

### Status Appuntamento (`appointments.status`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `scheduled` | Programmato |
| `completed` | Completato |
| `cancelled` | Annullato |

### Priorità Tasks (`pm_items.priority`)
| Valore DB | Testo mostrato |
|-----------|---------------|
| `low` | Bassa |
| `medium` | Media |
| `high` | Alta |
| `urgent` | Urgente |

### Tipi entità
| Valore DB | Testo mostrato |
|-----------|---------------|
| `attivita` | Attività |
| `task` | Task |
| `commessa` | Commessa |
| `incarico` | Incarico |

---

## 5. Mappa completa delle azioni per area

### 5.1 Area PM — Task (`pm_items`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_task` | "ha creato la task **{title}**" | `title`, `status` (default: todo) | `insert_action_name` nel registry |
| `task_updated:status` | "ha spostato **{title}** da **{old}** a **{new}**" | `old`, `new` (valori tradotti), `title` | Usare `activityTranslate()` su old/new |
| `task_updated:priority` | "ha impostato priorità **{new}** su **{title}**" | `old`, `new` (tradotti), `title` | |
| `task_updated:title` | "ha rinominato la task in **{new}**" | `old`, `new`, `title` | |
| `task_updated:due_date` | "ha cambiato la scadenza di **{title}** al **{new}**" | `new` (data formattata `it-IT`), `old`, `title` | Formattare data lato frontend |
| `task_updated:start_date` | "ha impostato inizio **{title}** al **{new}**" | `new`, `old`, `title` | |
| `task_updated:notes` | "ha aggiornato la descrizione di **{title}**" | `title` | Non mostrare il contenuto delle note |
| `task_updated:parent_ref` | "ha spostato **{title}** in un'altra sezione" | `title`, `old`, `new` | `new` è UUID genitore |
| `task_updated:cloud_links` | "ha allegato un documento a **{title}**" | `title` | |
| `task_updated:pm_user_ref` | "ha assegnato **{title}** a **{new}**" | `new` (nome utente da risolvere), `title` | `new` è UUID — risolvere con join profiles |
| `new_assignment` *(su pm_item_assignees)* | "ha aggiunto un membro al team di **{entity}**" | `entity` = titolo task (via `item_ref`) | Placeholder `{entity}` da risolvere frontend |
| `assignment_removed` *(su pm_item_assignees)* | "ha rimosso un membro dal team di **{entity}**" | `entity` = titolo task | |
| `new_resource` *(su pm_item_links)* | "ha aggiunto una risorsa a **{entity}**" | `entity`, `linked_entity_type` | |
| `resource_removed` *(su pm_item_links)* | "ha rimosso una risorsa da **{entity}**" | `entity`, `linked_entity_type` | |
| `new_comment` *(su pm_item_comments)* | "ha commentato su **{entity}**" | `entity` = titolo task, `body` | Non mostrare body raw, solo "ha commentato" |

**Regola display task:** Mostrare sempre il nome della task in grassetto. Se `item_ref` è presente, linkare alla task. Aggiungere "in **{space_name}**" solo se il contesto non mostra già la commessa.

---

### 5.2 Area PM — Spazi/Commesse (`pm_spaces`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_space` | "ha creato lo spazio **{name}**" | `name`, `ref_ordine` | Placeholder `{entity}` nel registry = bug, usare `{name}` |
| `space_updated:status` | "ha cambiato stato di **{name}** in **{new}**" | `old`, `new` (tradotti), `name` | |
| `space_updated:name` | "ha rinominato lo spazio in **{new}**" | `old`, `new`, `name` | |

---

### 5.3 Area Ordini/Commesse (`orders`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_order` | "ha creato la commessa **{title}**" | `title`, `client_ref` | `client_ref` → nome cliente via join |
| `order_updated:status_works` | "ha aggiornato lo stato lavori di **{title}** a **{new}**" | `old`, `new` (tradotti), `title` | Attenzione capitalizzazione mista |
| `order_updated:offer_status` | "ha aggiornato l'offerta di **{title}** a **{new}**" | `old`, `new` (tradotti), `title` | |
| `order_updated:p_m` | "ha assegnato **{title}** a **{new}**" | `new` = nome PM, `title` | `p_m` è UUID collaboratore |
| `order_updated:notes` | "ha aggiornato le note di **{title}**" | `title` | Non mostrare contenuto |
| `order_collaborator_added` | "ha aggiunto un collaboratore a **{title}**" | `title`, collaboratore | Azione su tabella relazione ordine-collaboratore |
| `order_collaborator_removed` | "ha rimosso un collaboratore da **{title}**" | `title` | |

---

### 5.4 Area Incarichi (`assignments`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_assignment` | "ha creato l'incarico **{description}**" | `description`, `collaborator_id` | `{entity}` nel registry = bug, usare `{description}` |
| `assignment_updated:status` | "ha cambiato stato incarico **{description}** a **{new}**" | `old`, `new` (tradotti), `description` | |
| `assignment_updated:description` | "ha rinominato l'incarico in **{new}**" | `old`, `new` | |
| `assignment_updated:budget` | "ha modificato il budget dell'incarico **{description}**" | `description`, `old`, `new` | Mostrare importo? Solo se non sensibile |
| `assignment_updated:payment_plan` | "ha aggiornato il piano pagamenti di **{description}**" | `description` | |
| `assignment_letter_generated` | "ha generato la lettera d'incarico per **{description}**" | `description` | Azione frontend, non da trigger DB |

---

### 5.5 Area Clienti (`clients`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_client` | "ha aggiunto il cliente **{business_name}**" | `business_name`, `email` | |
| `client_updated:business_name` | "ha rinominato il cliente in **{new}**" | `old`, `new` | |
| `client_updated:email` | "ha aggiornato l'email di **{business_name}**" | `business_name` | Non mostrare email nel log |
| `client_updated:phone` | "ha aggiornato il telefono di **{business_name}**" | `business_name` | |
| `client_updated:address` | "ha aggiornato l'indirizzo di **{business_name}**" | `business_name` | |

---

### 5.6 Area Collaboratori (`collaborators`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_collaborator` | "ha aggiunto il collaboratore **{full_name}**" | `full_name`, `role` | |
| `collaborator_updated` | "ha aggiornato il profilo di **{full_name}**" | `full_name` | Generico, non granulare |
| `collaborator_activated` | "ha riattivato il collaboratore **{full_name}**" | `full_name` | Toggle is_active → true |
| `collaborator_deactivated` | "ha disattivato il collaboratore **{full_name}**" | `full_name` | Toggle is_active → false |

---

### 5.7 Area Fatture Attive (emesse)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_invoice` | "ha creato la fattura **{number}** per **{client}**" | `number`, `client` (da join) | |
| `invoice_updated:status` | "ha aggiornato la fattura **{number}** a **{new}**" | `number`, `old`, `new` (tradotti) | |
| `invoice_updated:amount` | "ha modificato l'importo della fattura **{number}**" | `number`, `old`, `new` | |
| `invoice_sent` | "ha inviato la fattura **{number}** al cliente" | `number`, `client` | Azione esplicita, non solo status |
| `invoice_paid` | "la fattura **{number}** è stata contrassegnata come pagata" | `number` | Può essere automatica |
| `invoice_deleted` | "ha eliminato la fattura **{number}**" | `number` | Track delete = true |

---

### 5.8 Area Fatture Passive (ricevute)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_passive_invoice` | "ha registrato una fattura passiva da **{supplier}**" | `supplier`, `amount` | |
| `passive_invoice_updated:status` | "ha aggiornato la fattura passiva a **{new}**" | `old`, `new`, `supplier` | |
| `passive_invoice_paid` | "ha registrato il pagamento della fattura passiva" | `supplier`, `amount` | |

---

### 5.9 Area Pagamenti

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_payment` | "ha registrato un pagamento di **{amount}**" | `amount`, `order_ref` o `assignment_ref` | Mostrare a cosa è collegato |
| `payment_updated` | "ha modificato il pagamento di **{amount}**" | `amount` | |
| `payment_deleted` | "ha eliminato il pagamento di **{amount}**" | `amount` | |
| `payment_plan_updated` | "ha aggiornato il piano pagamenti" | contesto ordine/incarico | |

---

### 5.10 Area Movimenti Bancari

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_bank_movement` | "ha registrato un movimento bancario di **{amount}**" | `amount`, `description` | |
| `bank_movement_matched` | "ha abbinato un movimento a **{entity}**" | `entity` = fattura/pagamento | Riconciliazione |
| `bank_movement_updated` | "ha modificato un movimento bancario" | `description`, `amount` | |
| `bank_movement_deleted` | "ha eliminato un movimento bancario" | `amount` | |
| `bank_import` | "ha importato **{count}** movimenti bancari" | `count` | Import bulk da file |

---

### 5.11 Area Agenda / Appuntamenti (`appointments`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_appointment` | "ha creato l'appuntamento **{title}**" | `title`, `start_time` | Mostrare data/ora formattata |
| `appointment_updated:status` | "ha cambiato stato di **{title}** a **{new}**" | `title`, `old`, `new` (tradotti) | |
| `appointment_updated:start_time` | "ha spostato **{title}** al **{new}**" | `title`, `new` (data/ora formattata) | |
| `appointment_updated:title` | "ha rinominato l'appuntamento in **{new}**" | `old`, `new` | |
| `appointment_reminder_sent` | "promemoria inviato per **{title}**" | `title` | Auto-generato dal sistema (actor = Sistema) |

---

### 5.12 Area Documenti / File (`doc_pages`)

| action_type | Frase template | Variabili disponibili | Note |
|-------------|----------------|----------------------|------|
| `new_document` | "ha caricato il file **{file_name}**" | `file_name` (NON `title` — vedi BUG 3) | |
| `document_updated:title` | "ha rinominato il documento in **{new}**" | `old`, `new` | |
| `document_block_added` | "ha aggiunto un blocco a **{page_name}**" | `page_name`, `block_type` | Azioni editor di pagina |
| `document_block_updated` | "ha modificato un blocco in **{page_name}**" | `page_name` | |
| `document_block_deleted` | "ha rimosso un blocco da **{page_name}**" | `page_name` | |
| `document_block_reordered` | "ha riorganizzato i blocchi in **{page_name}**" | `page_name` | |
| `document_deleted` | "ha eliminato il documento **{file_name}**" | `file_name` | |

---

## 6. Regole del frontend (`pm_activity_helper.js`)

### 6.1 Mappa di normalizzazione `action_type`

Il sistema ha log storici con formati diversi. Il frontend deve mappare i vecchi formati al nuovo:

```javascript
const ACTION_TYPE_ALIASES = {
  // Vecchi formati grezzi
  'INSERT': 'new_item',
  'UPDATE': 'item_updated',
  'DELETE': 'item_deleted',
  // Vecchi formati da iterazioni precedenti
  'status_changed': 'task_updated:status',
  'pm_items:UPDATE:status': 'task_updated:status',
  'pm_items:updated:status': 'task_updated:status',
  'new_task': 'new_task', // già canonico
  // Aggiungere qui i nuovi alias man mano che vengono scoperti
};

const normalizeActionType = (actionType) => ACTION_TYPE_ALIASES[actionType] || actionType;
```

### 6.2 Regole di rendering

**Regola A — Anti-ridondanza (Entity == Container):**
Se `entityName` (task/space name) coincide esattamente con `containerName` (order/space name), NON mostrare la parte "in **{containerName}**". Es.: "ha creato **Commessa X** in **Commessa X**" → solo "ha creato **Commessa X**".

**Regola B — Fallback generico:**
Se il nome dell'entità non è disponibile (log orfano), usare una stringa contestuale fluida: "ha aggiunto un'attività in **{containerName}**" invece di mettere in grassetto "un'attività".

**Regola C — Traduzione enum:**
Applicare `activityTranslate()` sempre su `metadata.old` e `metadata.new` prima di inserirli nelle frasi. Non affidarsi alla `description` proveniente dal DB se contiene valori enum grezzi.

**Regola D — Risoluzione date:**
Formattare sempre le date con `new Date(val).toLocaleDateString('it-IT')`.

**Regola E — Risoluzione UUID:**
I valori in `metadata.new` per campi come `pm_user_ref`, `p_m`, `collaborator_id` sono UUID. Risolverli tramite join nelle query che recuperano i log, non lato helper.

**Regola F — Actor "Sistema":**
Se `actor_user_ref` è NULL, mostrare "Sistema" come nome attore (es. promemoria automatici, import bancari).

### 6.3 Deduplicazione visiva

Nascondere log consecutivi che condividono: stesso `actor_user_ref`, stesso `action_type`, stesso `item_ref`/`space_ref`/`order_ref`, e `created_at` entro lo stesso minuto. Mostrarne solo uno con indicatore "(× N)" se necessario.

```javascript
const deduplicateLogs = (logs) => {
  return logs.filter((log, idx) => {
    if (idx === 0) return true;
    const prev = logs[idx - 1];
    const sameActor = log.actor_user_ref === prev.actor_user_ref;
    const sameAction = log.action_type === prev.action_type;
    const sameRef = log.item_ref === prev.item_ref && log.space_ref === prev.space_ref;
    const sameMinute = log.created_at?.slice(0, 16) === prev.created_at?.slice(0, 16);
    return !(sameActor && sameAction && sameRef && sameMinute);
  });
};
```

---

## 7. Stato notifiche push per tabella

Tutte le notifiche sono attualmente **disabilitate** (`is_notification_enabled = false`). Prima di attivarle, definire:
- Template di notifica (`notification_template_insert`, `notification_template_update`)
- Destinatari (chi riceve la notifica)
- Condizioni di attivazione (non tutti gli UPDATE devono notificare)

| Tabella | Notifica attesa (futura) |
|---------|--------------------------|
| `pm_items` | Assegnatario notificato quando task viene assegnata a lui (`pm_user_ref`) |
| `pm_item_comments` | Assegnatario e creatore notificati su nuovi commenti |
| `pm_item_assignees` | Nuovo membro notificato quando aggiunto al team |
| `appointments` | Partecipanti notificati 24h prima (promemoria scheduled) |
| `orders` | PM notificato quando commessa assegnata a lui |
| Tutti gli altri | Da valutare — non prioritari |

---

## 8. Configurazione corrente del registry (snapshot 2026-03-27)

| Tabella | Track | insert_action_name | update_action_name | delete_action_name | Colonne tracciate |
|---------|-------|-------------------|-------------------|-------------------|------------------|
| `pm_items` | INS+UPD | `new_task` | `task_updated` | — | status, priority, start_date, due_date, notes, title, parent_ref, cloud_links, pm_user_ref |
| `pm_spaces` | INS+UPD | — | — | — | status, name |
| `pm_item_comments` | INS | — | — | — | tutte |
| `pm_item_assignees` | INS+DEL | `new_assignment` | — | `assignment_removed` | — |
| `pm_item_links` | INS+DEL | `new_resource` | — | `resource_removed` | — |
| `appointments` | INS+UPD | — | — | — | status, start_time, title |
| `assignments` | INS+UPD | — | — | — | status, description, collaborator_id |
| `clients` | INS+UPD | — | — | — | business_name, email, phone, address |
| `doc_pages` | INS | — | — | — | — |
| `orders` | UPD | — | — | — | p_m, notes, offer_status, status_works |

**Tabelle non ancora nel registry (da valutare):**
- `invoices` / fatture attive
- `passive_invoices` / fatture passive
- `payments`
- `bank_movements`
- `collaborators`

---

## 9. Checklist per aggiungere una nuova azione

Quando si aggiunge una nuova tabella o azione al sistema, verificare:

- [ ] Aggiunto record in `pm_activity_registry` con `table_name`, `is_active = true`
- [ ] Definito `insert_action_name` / `update_action_name` / `delete_action_name` (NON usare INSERT/UPDATE/DELETE maiuscolo)
- [ ] Template usa placeholder che corrispondono a **colonne reali** della tabella
- [ ] Se si traccia UPDATE: definiti `track_columns` e/o `column_templates`
- [ ] `order_ref_source`, `space_ref_source`, `item_ref_source` configurati correttamente per il contesto
- [ ] Trigger creato sulla tabella: `DROP TRIGGER IF EXISTS ... CREATE TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ...`
- [ ] Aggiornato questo file con la nuova azione nella sezione 5
- [ ] Aggiornato `activityVocabulary` in `pm_activity_helper.js` se ci sono nuovi valori enum
- [ ] Testato che `humanizeActivity()` produca la frase corretta
- [ ] Verificato che non ci siano duplicati nel feed (test con deduplicateLogs)

---

*Questo file viene aggiornato ad ogni modifica del sistema di activity feed. L'ultima revisione ha incluso analisi completa del codebase (frontend + migration SQL + registry DB).*

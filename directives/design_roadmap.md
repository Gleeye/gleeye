# Design Roadmap — Gleeye ERP

Questo file raccoglie **TODO e note sul design system** dell'app, da affrontare con calma nelle sessioni future. Serve come riferimento condiviso tra Davide, Claude e Antigravity.

---

## ⚠️ Principi fondamentali (NON violare mai)

1. **Minimalismo assoluto** — nessuna barra colorata full-width nei contenuti, nessun "hero banner" nelle pagine interne. Il colore va usato nei badge, nelle icone, nei grafici — non come sfondi dominanti.
2. **Glassmorphism coerente** — `rgba(255,255,255,0.7)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(255,255,255,0.3)`, `box-shadow: 0 8px 32px rgba(0,0,0,0.06)`, `border-radius: 16px`. Sempre.
3. **Font system** — Plus Jakarta Sans per i numeri KPI (font-size 1.4–1.8rem, font-weight 800), sistema normale per il body. Outfit per i numeri monetari. **Non mescolare altri font.**
4. **Nessun componente nativo del browser** — no `<select>`, no `window.confirm/alert/prompt`. Usare sempre CustomSelect e showGlobalAlert.

---

## 🔴 Priorità alta — Da fare presto

### 1. Uniformare il file `directives/ui_standard.md`
Il file attuale contiene solo regole tecniche generali, non una guida visiva concreta. Mancano:
- Screenshot/mockup di riferimento (o descrizioni precise) per KPI card, tabelle, badge
- Esempi di "cosa NON fare" (es. banner colorati nelle pagine interne)
- Specifiche tipografiche precise (quali font, quali size, quali weight per ogni elemento)
- Palette colori completa con i CSS custom properties usati (`--brand-blue`, `--text-primary`, etc.)

**Azione**: creare sezione "Visual Reference" in `ui_standard.md` con esempi HTML inline dei componenti base.

### 2. Inventario CSS custom properties
Non esiste un inventario di `--brand-blue`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--glass-border`, etc. Quando Claude o Antigravity generano codice, usano queste variabili "a intuito" rischiando inconsistenze.

**Azione**: documentare in `ui_standard.md` tutte le CSS custom properties definite nel progetto, con valore e contesto d'uso.

---

## 🟡 Priorità media — Da pianificare

### 3. Standardizzare la gestione degli status
Il DB contiene valori di status inconsistenti (`"In Corso"`, `"In corso"`, `"completed"`, `"Completato"`, `"To Do"`, `"todo"`). Tutti i componenti usano `.toLowerCase()` come patch, ma il problema è alla radice.

**Azione**: migration SQL per normalizzare i valori degli status su `assignments`, `payments`, `pm_items` verso enum definiti. Poi aggiornare le traduzioni frontend in un file centralizzato `utils/status.js`.

### 4. Componente tabella riutilizzabile
Ogni vista crea la sua tabella con HTML inline ripetuto. Andrebbe estratto un componente `renderTable(columns, rows)` in `js/components/Table.js`.

**Azione**: creare componente Table con supporto per: header con sort, badge di stato, importi allineati a destra, righe cliccabili, empty state.

### 5. Sistema di badge status centralizzato
La funzione `getStatusColor(status)` è duplicata in più file (`assignments.js`, `my_assignments.js`, `payments.js`). Andrebbe spostata in `utils.js` come unica fonte di verità.

**Azione**: aggiungere `getStatusMeta(status)` a `utils.js` che restituisce `{ color, label }` per tutti i tipi di status (assignment, payment, invoice, task priority).

---

## 🟢 Priorità bassa — Idee future

### 6. Responsive / Mobile
L'app non è pensata per mobile, ma alcuni collaboratori potrebbero usarla da telefono. Il layout a 2 colonne di `my_assignments.js` rompe su schermi stretti.

**Azione**: aggiungere `@media (max-width: 768px)` per collassare il grid a 1 colonna nelle viste principali.

### 7. Animazioni di transizione tra tab
Attualmente le tab cambiano contenuto istantaneamente. Una micro-animazione (fade-in 150ms) migliorerebbe la percezione.

### 8. Dark mode
Il sistema usa variabili CSS, il che rende tecnicamente possibile il dark mode. Non prioritario ma l'infrastruttura è già predisposta.

---

## 📋 Note operative per Claude/Antigravity

- Quando si genera una nuova pagina, partire sempre da KPI cards (se ci sono dati numerici), poi layout a 1 o 2 colonne, poi eventuale sezione tab per i dati storici/completi.
- Non usare `padding` maggiore di `1.5rem` nei container principali.
- I titoli delle sezioni interne alle card usano sempre: `font-weight: 700`, `font-size: .9–.95rem`, `color: var(--text-primary)`, con un'icona Material a sinistra colorata con il colore semantico della sezione.
- Le tabelle hanno sempre header con `font-size: .7rem`, `text-transform: uppercase`, `letter-spacing: .05em`, `color: var(--text-tertiary)`.
- I badge di stato hanno sempre: `border-radius: 6px`, `padding: 2–3px 8–9px`, `font-size: .7rem`, `font-weight: 700`, `background: {color}18`, `color: {color}`. Mai bordi solidi, mai background pieno.

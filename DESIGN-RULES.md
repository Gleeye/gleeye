# DESIGN-RULES — Gleeye ERP

Riferimento operativo per lo sviluppo UI. Leggilo prima di scrivere qualsiasi CSS o markup.
Fonte: `css/tokens.css`, `css/variables-v2.css`, `css/design-system.css`, `css/components/buttons.css`, `css/components/inputs.css`, `css/components/modals.css`, `css/components/notifications.css`.

---

## 1. Colori — usa sempre le CSS var, mai valori hex hardcoded

### Brand (invarianti al tema)
| Variabile | Valore | Quando usarla |
|---|---|---|
| `--brand-blue` | `#4e92d8` | Link attivi, focus ring, accenti primari |
| `--brand-viola` | `#614aa2` | Accenti secondari, select option selezionata, upload zone |
| `--brand-gradient` | blue→viola | Bottoni primari, heading modal, badge sezione attiva |

### Semantici (invarianti al tema)
| Variabile | Quando usarla |
|---|---|
| `--color-success` | Valori positivi, stati OK, conferme |
| `--color-success-soft` | Background soft per badge/icon success |
| `--color-success-text` | Testo verde su sfondo chiaro |
| `--color-error` | Errori, eliminazione, stati critici |
| `--color-error-soft` | Background soft per badge/icon error |
| `--color-warning` | Avvisi, scadenze, attenzione |
| `--color-warning-soft` | Background soft per badge/icon warning |
| `--color-info` | Informazioni neutrali (alias di `--brand-blue`) |

### Testo (cambiano con il tema)
| Variabile | Quando usarla |
|---|---|
| `--text-primary` | Testo principale, titoli |
| `--text-secondary` | Label, dati secondari, placeholder |
| `--text-tertiary` | Caption, timestamp, microtesto |

### Sfondi e bordi (cambiano con il tema)
| Variabile | Quando usarla |
|---|---|
| `--bg-primary` | Sfondo pagina |
| `--bg-secondary` | Sfondo sezioni rientranti |
| `--card-bg` / `--bg-card` | Card, modal, dropdown — ⚠️ DUPLICATO (vedi §8) |
| `--input-bg` | Sfondo input e select |
| `--glass-bg` | Sfondo glassmorphism leggero |
| `--glass-border` | Bordo standard quasi invisibile |
| `--bg-hover` | Hover su righe/item interattivi |

### Shadow
| Variabile | Quando usarla |
|---|---|
| `--shadow-soft` / `--shadow-sm` | Card a riposo — ⚠️ DUPLICATO (vedi §8) |
| `--shadow-premium` | Card in hover |
| `--shadow-lg` | Dropdown, panel |
| `--shadow-xl` | Modal, drawer |

### Alias legacy — da non introdurre in codice nuovo
`--primary` → usa `--brand-blue` | `--success-color` → usa `--color-success` | `--error-color` → usa `--color-error` | `--warning-color` → usa `--color-warning`

---

## 2. Bottoni — quale classe per quale caso

Il sistema usa **una sola classe base** `.primary-btn` con modificatori.

```html
<!-- Azione principale del modal / CTA principale -->
<button class="primary-btn">Salva</button>

<!-- Azione secondaria / Annulla -->
<button class="primary-btn secondary">Annulla</button>

<!-- Azione distruttiva (elimina, revoca) -->
<button class="primary-btn danger">Elimina</button>

<!-- Azione di conferma positiva -->
<button class="primary-btn success">Completa</button>

<!-- Bottone icona rotondo (azioni nella toolbar) -->
<button class="icon-btn">
  <span class="material-icons-round">more_vert</span>
</button>

<!-- Tab segmentate / toggle vista -->
<div class="segmented-control">
  <button class="segmented-btn active">Vista A</button>
  <button class="segmented-btn">Vista B</button>
</div>

<!-- Filtri a pill -->
<div class="pill-group">
  <button class="pill-item active">Tutti</button>
  <button class="pill-item">Attivi</button>
</div>
```

### Dimensioni
```html
<button class="primary-btn btn-sm">Piccolo</button>   <!-- default per toolbar compatte -->
<button class="primary-btn">Normale</button>           <!-- default modal -->
<button class="primary-btn btn-lg">Grande</button>     <!-- CTA hero / confirm bloccante -->
```

### Bottoni speciali
```html
<!-- Successo con sfondo pieno (alternativa a .primary-btn.success) -->
<button class="success-btn">Segna completato</button>

<!-- Rimuovi campo inline (icona rossa) -->
<button class="btn-remove-field">
  <span class="material-icons-round">delete</span>
</button>
```

### Stato disabilitato
```html
<button class="primary-btn" disabled>Salva</button>  <!-- opacity 0.5, cursor not-allowed, automatico -->
```

---

## 3. Form — classi standard

### Struttura base
```html
<div class="form-grid">
  <!-- Auto-fit colonne, min 280px -->

  <div class="form-group">
    <label>Nome campo</label>
    <input type="text" placeholder="...">
  </div>

  <div class="form-group full-width">
    <!-- Span tutta la larghezza del grid -->
    <label>Note</label>
    <textarea rows="4"></textarea>
  </div>
</div>
```

- `input`, `select`, `textarea` sono stilati globalmente — NON aggiungere classi extra su di essi salvo eccezioni
- `label` dentro `.form-group` riceve automaticamente: `0.85rem`, `font-weight: 600`, `text-transform: uppercase`

### Griglie form fisse (per modal con layout fisso)
```html
<div class="form-row-grid-2">…</div>  <!-- 2 colonne uguali -->
<div class="form-row-grid-3">…</div>  <!-- 3 colonne uguali -->
<div class="form-row-grid-1">…</div>  <!-- 1 colonna -->
```

### Input con icona (solo per auth / ricerca)
```html
<div class="input-group">
  <span class="material-icons-round">person</span>
  <input type="text" placeholder="Email">
</div>
```

### Select personalizzata (JS-driven)
```html
<div class="custom-select-container">
  <div class="custom-select-trigger">Scegli...</div>
  <div class="custom-select-options">
    <div class="custom-option">Opzione 1</div>
    <div class="custom-option selected">Opzione 2</div>
  </div>
</div>
<!-- JS aggiunge/rimuove la classe .open sul container -->
```

### Select searchable (JS-driven)
```html
<div class="searchable-select">
  <input type="text" class="select-search" placeholder="Cerca...">
  <div class="select-dropdown">
    <div class="select-option">Risultato</div>
    <div class="select-option selected">Selezionato</div>
  </div>
</div>
<!-- JS aggiunge/rimuove .hidden sul .select-dropdown -->
```

### Chips / tag input
```html
<div class="chips-container">
  <div class="chip">
    Tag nome
    <span class="remove material-icons-round">close</span>
  </div>
</div>
```

### Checkbox e radio
Stilati globalmente. Per checkbox inline con label usa:
```html
<label class="custom-checkbox">
  <input type="checkbox"> Testo opzione
</label>
```

---

## 4. Modal — come si apre e chiude

### Attivazione
- Aggiungere la classe `.active` al `.modal` per aprire
- Rimuovere `.active` per chiudere
- Il JS gestisce ESC e click sull'overlay

```html
<!-- Struttura base modal standard -->
<div class="modal" id="my-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Titolo modal</h2>
      <button class="close-modal">
        <span class="material-icons-round">close</span>
      </button>
    </div>

    <!-- Contenuto con sezioni opzionali -->
    <div class="modal-sections">
      <div class="modal-section">
        <div class="section-title">
          <span class="material-icons-round">settings</span>
          <h4>Sotto-sezione</h4>
        </div>
        <div class="form-grid">…</div>
      </div>
    </div>
  </div>
</div>
```

```js
// Apertura
document.getElementById('my-modal').classList.add('active');

// Chiusura
document.getElementById('my-modal').classList.remove('active');
```

### Dimensioni modal
- Default: `max-width: 1000px` — per form complessi
- Il modal è sempre full-height su mobile (vedi §6)

### Z-index modal
| Layer | Variabile | Valore |
|---|---|---|
| Modal standard | `--z-modal` | 1200 |
| System modal (alert/confirm) | `--z-system` | 1300 |
| Toast | `--z-toast` | 1400 |

---

## 5. Feedback all'utente

### Toast (notifica rapida, non bloccante)
Il sistema toast è integrato nel modulo notifiche. Per trigger manuali semplici usa `showAlert`:

```js
// Alert bloccante (sostituisce window.alert)
await showAlert('Operazione completata!', 'success');  // 'success' | 'error' | 'warning' | 'info'

// Conferma bloccante (sostituisce window.confirm)
const ok = await showConfirm('Vuoi eliminare questo elemento?', {
  confirmText: 'Elimina',
  cancelText: 'Annulla',
  type: 'danger'   // 'danger' | 'warning' | 'info'
});
if (ok) { /* procedi */ }
```

> `showAlert` e `showConfirm` sono globali (window.showAlert, window.showConfirm). Non serve import.

### Alert inline ⚠️ DA CREARE
Non esiste una classe CSS standard per alert inline tipo `.alert-success`, `.alert-error`, ecc.
Nel frattempo usa badge o icone colorate. **Da definire** quando serve un pattern stabile.

### Badge di stato
```html
<span class="badge badge-success">Attivo</span>
<span class="badge badge-error">Scaduto</span>
<span class="badge badge-warning">In attesa</span>
<span class="badge badge-neutral">Bozza</span>
```

### Dot di stato
```html
<span class="status-dot status-dot-success"></span>
<span class="status-dot status-dot-error"></span>
<span class="status-dot status-dot-warning"></span>
<span class="status-dot status-dot-info"></span>
```

### Valori numerici colorati
```html
<span class="value-success">+1.200 €</span>
<span class="value-error">-450 €</span>
<span class="value-warning">in scadenza</span>
<span class="value-neutral">n/d</span>
```

---

## 6. Breakpoint standard

CSS non supporta var() nei @media. Usa **sempre questi valori esatti**:

```css
/* Mobile — layout a colonna singola */
@media (max-width: 768px) { … }

/* Tablet — aggiustamenti grid e sidebar */
@media (max-width: 1024px) { … }

/* Desktop piccolo — opzionale, usalo solo se serve */
@media (max-width: 1280px) { … }
```

Comportamenti automatici già codificati in `design-system.css`:
- `.grid-2`, `.grid-3` → diventano 1 colonna a ≤768px
- `.page-header` → diventa colonna a ≤768px
- Modal → full-screen a ≤768px

---

## 7. Loading e empty state

### Loading state (lista in caricamento)
```html
<div class="loading-state">
  <div class="spinner"></div>
  <p>Caricamento in corso...</p>
</div>
```

### Empty state (lista vuota)
```html
<div class="empty-state">
  <span class="material-icons-round empty-icon">inbox</span>
  <h3 class="empty-title">Nessun elemento trovato</h3>
  <p class="empty-subtitle">Aggiungi il primo elemento per iniziare.</p>
</div>
```

> Entrambi i pattern sono definiti in `css/design-system.css` — non reinventarli.

---

## 8. Regole vietate

**Non fare mai:**

```css
/* ❌ Stili inline su bottoni */
<button style="background: #4e92d8; color: white">

/* ❌ Colori hex hardcoded nel CSS di una feature */
color: #ef4444;           /* usa --color-error */
background: #10b981;      /* usa --color-success */

/* ❌ Media query con valori non standard */
@media (max-width: 800px)  /* usa 768px */
@media (max-width: 900px)  /* usa 1024px */

/* ❌ Larghezze fisse in px sulle colonne grid di layout */
grid-template-columns: 300px 1fr;  /* usa minmax() o fr */

/* ❌ font-weight: 600 o 700 sul testo body */
/* Il design system è ultra-light. 600+ solo su label form e titoli heading */

/* ❌ z-index arbitrari */
z-index: 9999;  /* usa le variabili --z-modal, --z-toast, ecc. */

/* ❌ transform: translateY() su bottoni senza transition */
/* Tutti i bottoni hanno già transition in buttons.css */
```

**Non introdurre mai:**
- Nuove font-family (le uniche sono `--font-display` / `--font-titles` = Satoshi, `--font-body` = Plus Jakarta Sans)
- Nuovi valori di border-radius non da token (`--radius-sm/md/lg/xl/full`)
- `!important` salvo override di librerie terze

---

## 9. Tipografia — classi di testo

```html
<h1 class="text-display">Titolo grande</h1>     <!-- 2rem, Satoshi -->
<h2 class="text-title">Titolo sezione</h2>       <!-- 1.35rem, Satoshi -->
<h3 class="text-heading">Sotto-titolo</h3>       <!-- 1.1rem, Satoshi -->
<p class="text-subheading">Sub-heading</p>       <!-- 0.95rem, Satoshi -->
<p class="text-body">Testo normale</p>           <!-- 0.9rem, body font -->
<span class="text-caption">ETICHETTA</span>      <!-- 0.75rem, uppercase, text-tertiary -->
<span class="text-small">Micro testo</span>      <!-- 0.7rem -->
```

Per la pagina, usa `.page-title` e `.page-subtitle` dentro `.page-header`:
```html
<div class="page-header">
  <div>
    <h1 class="page-title">Nome Vista</h1>
    <p class="page-subtitle">Descrizione opzionale</p>
  </div>
  <div class="header-actions">
    <button class="primary-btn">+ Nuovo</button>
  </div>
</div>
```

---

## 10. Layout utility

```html
<!-- Grid responsive auto-fit -->
<div class="grid-auto">…</div>

<!-- Grid 2 colonne (→ 1 su mobile) -->
<div class="grid-2">…</div>

<!-- Flex con space-between -->
<div class="flex-between">…</div>

<!-- Flex allineato a sinistra con gap -->
<div class="flex-start">…</div>

<!-- Flex colonna -->
<div class="flex-column">…</div>
```

---

## 11. Card

```html
<!-- Card standard -->
<div class="minimal-card">Contenuto</div>

<!-- Varianti dimensione -->
<div class="minimal-card minimal-card-sm">Compatta</div>
<div class="minimal-card minimal-card-lg">Spaziosa</div>
```

---

## 12. Duplicati e gap noti

| Problema | Dettaglio |
|---|---|
| ⚠️ DUPLICATO | `--card-bg` (variables-v2) e `--bg-card` (tokens) sono la stessa cosa. Usa `var(--card-bg, var(--bg-card))` o solo `--card-bg` |
| ⚠️ DUPLICATO | `--shadow-soft` (variables-v2) e `--shadow-sm` (tokens) sono quasi identici (light: 0.03 vs 0.04). Preferire `--shadow-soft` |
| ⚠️ DUPLICATO | `--border-radius-*` in variables-v2 e `--radius-*` in tokens hanno valori diversi. Usare sempre `--radius-*` da tokens |
| ⚠️ DUPLICATO | `homepage.css` e `homepage-alt.css` coesistono — probabilmente dead code parziale |
| ⚠️ DA CREARE | Classi alert inline (`.alert-success`, `.alert-error`, ecc.) non esistono |
| ⚠️ DA CREARE | Classe `.btn-secondary` non esiste come standalone — si usa `.primary-btn.secondary` |
| ⚠️ DA CREARE | Nessun utility di `text-truncate` o `text-ellipsis` codificato come classe |
| ⚠️ ATTENZIONE | `--font-titles` (variables-v2) e `--font-display` (tokens) sono entrambi Satoshi — usa `--font-titles` in codice esistente, `--font-display` in codice nuovo |

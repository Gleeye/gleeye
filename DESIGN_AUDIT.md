# Design Audit — Gleeye ERP

**Data**: 15 maggio 2026
**Scope**: tutte le viste principali (sidebar navigation), CSS components, JS inline styles, responsive behavior
**Metodo**: lettura codice CSS/JS + analisi strutturale. Nessuna modifica al codice.

---

## 1. Stato attuale del design system

### Cosa funziona bene

- **Palette base** (`variables-v2.css`): light/dark theme con CSS custom properties coerenti per bg, text, glass effects
- **Typography scale** (`design-system.css`): 7 livelli ben definiti (display → small), font-family separata per titoli (Satoshi) e body (Plus Jakarta Sans)
- **Utility classes** (`design-system.css`): grid-2/3, flex-between/start/column, spacing mt/mb/p utilities funzionali
- **Design system CSS esiste** e ha le basi giuste: card, badge, status-dot, icon-container, date-badge
- **Mobile overrides** (`mobile-overrides.css`): modal fullscreen, form grid 1-col, 16px input per no-zoom iOS, tab scrollabili
- **Preconnect font** tag presenti per Fontshare e Google Fonts

### Cosa non funziona

#### A. Frammentazione dei token di design

Il design system CSS definisce variabili, ma il codice reale le ignora massicciamente:

| Problema | Dimensione |
|----------|-----------|
| Inline `style=` nei file JS | **8.530 occorrenze** in 60+ file |
| Colori hex hardcoded nei JS | 30+ colori distinti, top 9 usati 100+ volte ciascuno |
| Border-radius distinti | 15+ valori (4px, 6px, 8px, 10px, 12px, 14px, 16px, 20px, 24px, 32px, 50%) |
| Max-width modal distinti | 10+ valori (400–1200px), tutti inline |
| Breakpoint distinti nei JS | 10+ valori (760, 768, 992, 1024, 1100, 1150, 1200, 1280, 1350, 1550px) |

#### B. Duplicazione CSS

| File duplicati | Problema |
|---------------|----------|
| `homepage.css` vs `homepage-alt.css` | ~95% identici, 1184 vs ~1500 righe, conflitti diretti su `.greeting-section h1` (2.5rem vs 1.85rem), `.widget-title` (1.25rem vs 1.05rem) |
| `inputs.css` vs `custom-select.css` | Entrambi definiscono `.custom-select-trigger` e `.custom-option` con padding e focus ring diversi |
| `layout.css` vs `payments.css` | Entrambi definiscono `.info-grid` |
| `animations.css` vs `modals.css` | Entrambi definiscono `@keyframes scaleIn` con parametri diversi |
| `sidebar.css` vs `notifications.css` | Entrambi definiscono `.notification-badge` (8px solid vs 18px gradient) |

#### C. Z-index senza scala

| Elemento | Z-index |
|----------|---------|
| `.top-bar` / `.sidebar` | 100 |
| `.top-bar` mobile (inline patch) | 1000 !important |
| Error overlay (JS) | 9999 |
| Notification dropdown | 10000 |
| Toast | 10001 |
| Sidebar mobile (inline patch) | 99999 !important |
| Hub drawer overlay | 99999 |
| Splash screen | 99999 |
| Modal | 99999 |
| System modal | 1000000 |

Tre elementi a 99999 competono senza ordine definito. Splash screen resta nel DOM dopo il fade (opacity: 0, pointer-events: none) mantenendo lo stacking context.

#### D. Variabili CSS inconsistenti tra file

| File | Usa | Standard |
|------|-----|---------|
| `notifications.css` | `--primary`, `--bg-hover`, `--border-color` | `--brand-blue`, `--glass-bg`, `--glass-border` |
| `bank_transactions.css` | `var(--radius-lg)` | `var(--border-radius-lg)` |
| `chat.css` | `var(--error-color)`, `var(--bg-color)` | `var(--danger-color)` (non definita), `var(--bg-color)` ok |
| `chat.css` | `var(rgba(78,146,216,0.1))` | Sintassi CSS invalida |

---

## 2. Audit per vista

### Homepage (Admin)

**File**: `homepage.js` (3.189 righe), `homepage-alt.js` (1.477 righe), `homepage.css`, `homepage-alt.css`

- **Funziona**: layout a widget, KPI pills, shortcut section
- **Rotto**: due file CSS quasi identici caricati insieme = conflitti di stile imprevedibili
- **Mobile 375px**: hardcoded `background: #1e293b` su `.side-activities-card`, nav pills con `background: white` (rompe dark mode), widget title size inconsistente
- **Spacing**: padding widget mix di 1.5rem, 2rem, 2.5rem senza pattern
- **Bottoni**: `.hp-date-btn` hardcodes `background: white; border: 1px solid #e5e7eb; color: #4b5563` — 3 valori non tokenizzati

### Homepage (Collaboratore)

**File**: `user_dashboard.js` (1.776 righe, 243 inline styles)

- **Funziona**: struttura dashboard con sezioni dedicate
- **Mobile**: 4 embedded `<style>` blocks con media query inline nel JS
- **Spacing**: incoerente con homepage admin

### Clienti

**File**: `clients.js` (1.515 righe, 189 inline styles)

- **Funziona**: lista + dettaglio, filtri
- **Mobile**: 2 `@media` query embedded nel JS
- **Spacing**: card padding hardcoded inline in molteplici varianti

### Contatti

**File**: `contacts.js` — vista scheletrica (read-only)

- **Funziona**: lista base
- **Rotto**: nessun CRUD da UI, no tab nel dettaglio cliente, no mobile consideration

### Collaboratori

**File**: `collaborators.js` (225 inline styles)

- **Funziona**: lista ricca con 4 tab, impersona, magic link
- **Mobile**: nessuna media query specifica
- **Spacing**: inline styles dominanti

### Partner WL

**File**: `white_label_partners.js` — duplicazione parziale di `collaborators.js`

- **Funziona**: lista base con stessa struttura collaboratori
- **Rotto**: codice duplicato, stesse inconsistenze del parent

### Fornitori

**File**: `suppliers.js` (dead code probabile), `suppliers_v2.js`

- **Funziona**: lista base
- **Mobile**: nessuna media query specifica

### Ordini/Commesse

**File**: `orders.js` (249 inline styles — file caldo, non toccare)

- **Funziona**: hub commessa completo, 3 stati paralleli
- **Mobile**: problematico — molti elementi con width inline
- **Bottoni**: mix di `.primary-btn`, `.success-btn`, e stili inline custom

### Incarichi (Assignments)

**File**: `assignments.js` (2.023 righe, 292 inline styles)

- **Funziona**: lista + dettaglio
- **Mobile**: nessuna media query specifica nel file CSS, tutto inline
- **Spacing**: terzo file per quantita di inline styles

### Fatture Attive / Passive

**File**: `invoices.js` (2.060 righe), `invoices/` subdir

- **Funziona**: listing funzionale, filtri per tipo
- **Mobile**: limitato
- **Bottoni**: inconsistenti con il resto delle viste

### Banca

**File**: `bank_transactions.css`, `bank_transactions.js`, `bank_statements.js`

- **Funziona**: KPI card grid, transaction row layout
- **Rotto**: `var(--radius-lg)` probabilmente indefinita (standard e `--border-radius-lg`)
- **Mobile**: nessuna media query in `bank_transactions.css`, KPI grid collassa solo via `mobile-overrides.css`

### Cassa (Payments)

**File**: `payments.js` (186 inline styles), `payments.css`

- **Funziona**: tab bar, info grid
- **Rotto**: breakpoint mobile a `<= 1024` (unico file, tutti gli altri usano 768)
- **Bottoni**: tab usa `--brand-viola` per active/hover, resto dell'app usa `--brand-blue`

### Agenda

**File**: `personal_agenda.js` (1.874 righe), `agenda.css`

- **Funziona**: calendario settimanale/mensile, mini-cal
- **Rotto al 100% su mobile**: NESSUNA `@media` query in `agenda.css`, nessun responsive consideration
- **Dark mode rotto**: `.mode-btn.active`, `.today-btn`, `.icon-nav-btn`, `.monthly-day-box` tutti con `background: white` hardcoded
- **Spacing**: `calc(100vh - 120px) !important` — magic number 120px

### Le mie task

**File**: `pm/` subdir, kanban views

- **Funziona**: kanban 4 colonne con drag
- **Mobile**: le colonne kanban non collassano, orizzontale scroll forzato

### Profilo

- **Funziona**: form standard
- **Rotto**: `#profile-form input:disabled` scoped solo a profilo, nessuno stile disabled globale

### Amministrazione

**File**: `admin/` subdir, `dashboard.js` (3 `@media` embedded), `settings.js`

- **Funziona**: sezioni configurazione
- **Mobile**: dashboard admin con media query inline nel JS

---

## 3. Problemi trasversali

### A. Inline styles: i numeri

I 3 file peggiori contengono il 12% di tutti gli inline styles:

| File | Inline `style=` | Righe totali |
|------|-----------------|-------------|
| `sap_services.js` | 369 | 1.671 |
| `pm/components/hub_drawer.js` | 347 | 2.595 |
| `assignments.js` | 292 | 2.023 |

### B. Colori hardcoded piu frequenti

| Colore | Count | Equivalente CSS var |
|--------|-------|-------------------|
| `#ef4444` | 265 | `--error-color` |
| `#10b981` | 250 | `--success-color` |
| `#f59e0b` | 204 | `--warning-color` |
| `#3b82f6` | 190 | ~`--brand-blue` (non esatto) |
| `#94a3b8` | 182 | `--text-secondary` |
| `#f1f5f9` | 158 | nessuno (bg secondario) |
| `#e2e8f0` | 147 | nessuno (border) |
| `#8b5cf6` | 144 | ~`--brand-viola` (non esatto) |
| `#64748b` | 127 | `--text-tertiary` |

### C. Modal senza root

Nessun `#modal-root` nel DOM. Ogni modulo JS fa `document.body.appendChild(modalEl)` indipendentemente. Nessun focus trap, nessuno scroll lock centralizzato.

### D. Bottoni: stato attuale

| Classe | Dove definita | Radius | Padding | Font-size |
|--------|--------------|--------|---------|-----------|
| `.primary-btn` | buttons.css | 10px | 0.65rem 1.35rem | 0.9rem |
| `.primary-btn.secondary` | buttons.css | 10px | 0.65rem 1.35rem | 0.9rem |
| `.icon-btn` | buttons.css | 50% | 0.6rem | — |
| `.success-btn` | design-system.css | 8px | 0.6rem 1.2rem | 0.85rem |
| `.segmented-btn` | buttons.css | 8px | 0.55rem 1.25rem | 0.9rem |
| `.pill-item` | buttons.css | 20px | 0.4rem 1rem | 0.8rem |
| `.tab-btn` | payments.css | — | 0.85rem 0.5rem | — |
| Inline buttons | 60+ file | vari | vari | vari |

Nessuno ha stato `:disabled` definito. Solo `.primary-btn` ha `:focus`. `.icon-btn:hover` hardcoda `background: white`.

### E. Accessibilita

- `user-scalable=no` + `maximum-scale=1.0` nel viewport meta tag: viola WCAG 1.4.4
- Nessun focus ring visibile sui bottoni (eccetto `.primary-btn`)
- Tab navigation non testata
- Nessun `aria-label` sui bottoni icon-only

### F. Dark mode rotto in molteplici viste

File con `background: white` o colori light hardcoded che rompono dark mode:

- `agenda.css`: 5 selettori con `background: white`
- `sidebar.css` mobile: `background: white !important`
- `layout.css` mobile top-bar: `background: #ffffff`, `border: #f1f1f1`, `border: #f1f5f9`
- `homepage.css`: `.nav-pill`, `.hp-date-btn` con colori light hardcoded
- `buttons.css`: `.icon-btn:hover` con `background: white`

---

## 4. TOP 10 Bug operativi — Priorita

### P0 — Critici (usabilita bloccata)

1. **Agenda completamente non-responsive**: nessuna `@media` query in `agenda.css`, layout 2-colonne (280px + 1fr) rigido, mini-calendar e griglia oraria non collassano. Su 375px la vista e inutilizzabile — le colonne si sovrappongono o escono dalla viewport.

2. **Dark mode rotto su agenda**: 5 elementi con `background: white` hardcoded (`mode-btn.active`, `today-btn`, `icon-nav-btn`, `monthly-day-box`, `monthly-day-box:hover`). In dark mode questi elementi sono quadrati bianchi accecanti.

3. **Dark mode rotto su sidebar mobile**: `background: white !important` in `sidebar.css` linea mobile — la sidebar su mobile in dark mode e bianca.

### P1 — Gravi (degradazione visiva significativa)

4. **Dark mode rotto su top-bar mobile**: `layout.css` mobile override usa `background: #ffffff`, `border-bottom: 2px solid #f1f1f1`, `border: 1px solid #f1f5f9` tutti hardcoded — barra superiore bianca in dark mode.

5. **Homepage CSS duplicata**: `homepage.css` e `homepage-alt.css` sono 95% identici ma con conflitti diretti. `.greeting-section h1` ha due dimensioni diverse (1.85rem vs 2.5rem), `.widget-title` idem (1.05rem vs 1.25rem). Il rendering dipende dall'ordine di caricamento.

6. **Notifications CSS usa variabili inesistenti**: `notifications.css` usa `--primary`, `--bg-hover`, `--border-color`, `--border-hover` — naming scheme completamente diverso dal resto dell'app. Queste variabili probabilmente cadono al valore iniziale del browser (trasparente/nero).

### P2 — Importanti (inconsistenza visiva)

7. **Breakpoint incoerente in payments.js**: usa `<= 1024` come soglia mobile, tutti gli altri file usano `768`. Su tablet (769–1024px) la vista pagamenti si comporta come mobile mentre tutto il resto e desktop.

8. **Custom select duplicato**: `inputs.css` e `custom-select.css` definiscono entrambi `.custom-select-trigger` con padding diverso (1rem vs 0.6rem) e focus ring diverso (4px vs 2px). Il risultato cambia a seconda di quale CSS vince.

9. **Sintassi CSS invalida in chat.css**: `.chat-nav-item.active` usa `var(rgba(78,146,216,0.1))` — `var()` wrapping un `rgba()` direttamente e CSS invalido, la regola viene ignorata dal browser.

### P3 — Fastidiosi (polish)

10. **Splash screen mai rimosso dal DOM**: `#app-splash-screen` dopo il fade resta nel DOM con `opacity: 0; pointer-events: none` a z-index 99999, mantenendo un stacking context inutile. Dovrebbe essere `display: none` o rimosso.

---

## Note per i prossimi passi

Questo audit e solo diagnostico. I fix proposti saranno in `DESIGN_SYSTEM_PROPOSAL.md`. Nessun codice e stato modificato.

I file JS caldi (homepage.js, orders.js, clients.js, collaborators.js, assignments.js, invoices.js) NON vanno toccati senza coordinamento — contengono migliaia di inline styles ma sono anche i file piu fragili e usati quotidianamente.

# Design System Proposal — Gleeye ERP

**Data**: 15 maggio 2026
**Stato**: proposta, da validare con Davide prima di qualsiasi implementazione

---

## 1. Spacing Scale

Base: 4px. Ogni step e un multiplo di 4.

```css
:root {
    --space-1: 4px;    /* micro: gap tra icon e label inline */
    --space-2: 8px;    /* small: padding interno badge, gap tra chip */
    --space-3: 12px;   /* medium: padding input compatto, gap tra form elements */
    --space-4: 16px;   /* default: padding card small, gap grid standard */
    --space-5: 20px;   /* — */
    --space-6: 24px;   /* large: padding card standard, margin tra sezioni */
    --space-8: 32px;   /* xlarge: padding card grande, margin tra blocchi */
    --space-12: 48px;  /* xxlarge: padding pagina, spazio tra macro-sezioni */
}
```

**Regola**: niente `1.5rem`, `2rem`, `2.5rem` sparsi. Ogni padding/margin/gap deve mappare a un token `--space-*`. I file CSS attuali usano almeno 20 valori diversi di padding — questa scala li riduce a 8.

---

## 2. Palette completa

### Brand

```css
:root {
    /* Brand — invarianti tra light/dark */
    --brand-blue: #4e92d8;
    --brand-blue-rgb: 78, 146, 216;
    --brand-viola: #614aa2;
    --brand-viola-rgb: 97, 74, 162;
    --brand-gradient: linear-gradient(135deg, var(--brand-blue) 0%, var(--brand-viola) 100%);
}
```

### Gray scale (neutrali)

```css
:root[data-theme='light'] {
    --gray-50: #fafbfc;   /* bg pagina */
    --gray-100: #f1f5f9;  /* bg secondario, hover card */
    --gray-200: #e2e8f0;  /* border, divider */
    --gray-300: #cbd5e1;  /* border hover, placeholder */
    --gray-400: #94a3b8;  /* text terziario */
    --gray-500: #64748b;  /* text secondario */
    --gray-600: #475569;  /* text secondario scuro */
    --gray-700: #334155;  /* — */
    --gray-800: #1e293b;  /* text primario */
    --gray-900: #0f172a;  /* text primario forte */
}

:root[data-theme='dark'] {
    --gray-50: #0a0a0a;
    --gray-100: #141414;
    --gray-200: #1e1e1e;
    --gray-300: #2a2a2a;
    --gray-400: #525252;
    --gray-500: #737373;
    --gray-600: #a3a3a3;
    --gray-700: #d4d4d4;
    --gray-800: #e5e5e5;
    --gray-900: #fafafa;
}
```

### Semantic

```css
:root {
    --color-success: #10b981;
    --color-success-soft: rgba(16, 185, 129, 0.08);
    --color-success-text: #059669;

    --color-error: #ef4444;
    --color-error-soft: rgba(239, 68, 68, 0.08);
    --color-error-text: #dc2626;

    --color-warning: #f59e0b;
    --color-warning-soft: rgba(245, 158, 11, 0.08);
    --color-warning-text: #d97706;

    --color-info: var(--brand-blue);
    --color-info-soft: rgba(var(--brand-blue-rgb), 0.08);
    --color-info-text: var(--brand-blue);
}
```

### Mapping semantico (sostituisce le variabili attuali)

```css
:root[data-theme='light'] {
    --bg-primary: var(--gray-50);
    --bg-secondary: var(--gray-100);
    --bg-card: #ffffff;
    --bg-input: rgba(255, 255, 255, 0.8);
    --bg-overlay: rgba(0, 0, 0, 0.4);

    --text-primary: var(--gray-900);
    --text-secondary: var(--gray-500);
    --text-tertiary: var(--gray-400);

    --border-default: var(--gray-200);
    --border-hover: var(--gray-300);
    --border-focus: var(--brand-blue);

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.03);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.08);
    --shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

**Migrazione**: i ~1.500 hex hardcoded nei JS (`#ef4444`, `#10b981`, `#f59e0b`, `#94a3b8`, `#f1f5f9`, `#e2e8f0`, `#64748b`) mappano 1:1 a questi token. La migrazione puo essere meccanica (find & replace).

---

## 3. Typography

### Font stack (invariato)

```css
:root {
    --font-display: 'Satoshi', sans-serif;
    --font-body: 'Plus Jakarta Sans', sans-serif;
}
```

### Scale

```css
:root {
    /* Display — solo hero, greeting */
    --text-display: 2rem;        /* 32px */

    /* Title — page title */
    --text-title: 1.35rem;       /* ~22px */

    /* Heading — section title */
    --text-heading: 1.1rem;      /* ~18px */

    /* Subheading — card title, widget title */
    --text-subheading: 0.95rem;  /* ~15px */

    /* Body — contenuto standard */
    --text-body: 0.875rem;       /* 14px */

    /* Small — label, metadata */
    --text-small: 0.8rem;        /* ~13px */

    /* Caption — tag, badge, label uppercase */
    --text-caption: 0.7rem;      /* ~11px */

    /* Micro — contatore, dot label */
    --text-micro: 0.625rem;      /* 10px */
}
```

### Weight

```css
:root {
    --weight-normal: 400;
    --weight-medium: 500;
    --weight-semibold: 600;
    --weight-bold: 700;
}
```

**Regola**: `font-weight: 450` (usato in `sidebar.css`) non e standard. Solo 400/500/600/700.

**Regola headings**: attualmente `base.css` forza `font-weight: 700` su tutti gli h1–h6. Il design system (`design-system.css`) usa `font-weight: 400` sulle classi `.text-title` etc. Questo conflitto va risolto: i tag semantici (h1–h6) devono seguire le classi, non il contrario. Proposta: rimuovere il `font-weight: 700 !important` da `base.css` e lasciare che le classi utility controllino il peso.

---

## 4. Button System

### Varianti

| Variante | Background | Text | Border | Uso |
|----------|-----------|------|--------|-----|
| **Primary** | `var(--brand-gradient)` | white | none | CTA principale (1 per schermata) |
| **Secondary** | transparent | `var(--text-primary)` | `var(--border-default)` | Azioni secondarie |
| **Danger** | `var(--color-error-soft)` | `var(--color-error-text)` | none | Elimina, annulla |
| **Success** | `var(--color-success-soft)` | `var(--color-success-text)` | none | Conferma, salva |
| **Ghost** | transparent | `var(--text-secondary)` | none | Azioni terziarie, inline |
| **Icon** | transparent | `var(--text-secondary)` | none | Solo icona (menu, close, etc.) |

### Sizes

```css
/* Small — inline actions, table row buttons */
.btn-sm {
    height: 32px;
    padding: 0 var(--space-3);     /* 0 12px */
    font-size: var(--text-small);  /* 13px */
    border-radius: 8px;
    gap: var(--space-1);           /* 4px */
}

/* Medium — default, form buttons, card actions */
.btn-md {
    height: 40px;
    padding: 0 var(--space-4);     /* 0 16px */
    font-size: var(--text-body);   /* 14px */
    border-radius: 10px;
    gap: var(--space-2);           /* 8px */
}

/* Large — hero CTA, modal primary action */
.btn-lg {
    height: 48px;
    padding: 0 var(--space-6);     /* 0 24px */
    font-size: var(--text-body);   /* 14px */
    border-radius: 12px;
    gap: var(--space-2);           /* 8px */
}
```

### States (tutti obbligatori)

```css
.btn {
    /* Base */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    font-family: var(--font-body);
    font-weight: var(--weight-medium);
    transition: all 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
}

/* Hover — leggero lift + shadow */
.btn:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

/* Active — press down */
.btn:active {
    transform: translateY(0);
    box-shadow: none;
}

/* Focus visible — keyboard nav ring */
.btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--brand-blue-rgb), 0.3);
}

/* Disabled — dimmed, no interaction */
.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
    transform: none;
    box-shadow: none;
}

/* Loading — spinner, no click */
.btn[aria-busy="true"] {
    pointer-events: none;
    opacity: 0.7;
}
```

### Icon button (circolare)

```css
.btn-icon {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    /* size variants: --btn-icon-sm: 28px, --btn-icon-lg: 44px */
}
```

**Migrazione**: `.primary-btn` → `.btn.btn-primary.btn-md`, `.primary-btn.secondary` → `.btn.btn-secondary.btn-md`, `.icon-btn` → `.btn-icon`, `.success-btn` → `.btn.btn-success.btn-md`. I ~100 bottoni inline-styled nei JS richiedono refactor progressivo file per file.

---

## 5. Breakpoints

```css
:root {
    /* Mobile first: default = mobile */
    --bp-sm: 480px;    /* smartphone grande */
    --bp-md: 768px;    /* tablet portrait */
    --bp-lg: 1024px;   /* tablet landscape / laptop piccolo */
    --bp-xl: 1280px;   /* desktop */
    --bp-2xl: 1536px;  /* desktop grande */
}
```

**Utilizzo (media query)**:

```css
/* Mobile-first: stile base = mobile, poi override */
@media (min-width: 768px) { /* tablet+ */ }
@media (min-width: 1024px) { /* desktop */ }
@media (min-width: 1280px) { /* desktop grande */ }
```

**Stato attuale vs proposta**:

| Attuale | Proposta | Note |
|---------|----------|------|
| `max-width: 380px` | `max-width: 479px` (sotto sm) | Smartphone piccoli |
| `max-width: 600px` | Eliminare | Usato solo in `notifications.css`, unificare a 480px |
| `max-width: 768px` | `min-width: 768px` (invertire direzione) | Breakpoint principale, usato in 10+ file |
| `max-width: 1024px` | `min-width: 1024px` | Detail layout collapse |
| `max-width: 1200px` | `min-width: 1280px` | Homepage wide layout |

**JS breakpoints**: i 10 file che usano `window.innerWidth` devono leggere da un unico oggetto `BREAKPOINTS` esportato, non numeri magici. Esempio:

```js
// js/modules/breakpoints.js
export const BP = { sm: 480, md: 768, lg: 1024, xl: 1280 };
export const isMobile = () => window.innerWidth < BP.md;
```

---

## 6. Border Radius Scale

```css
:root {
    --radius-sm: 6px;    /* badge, chip, piccoli elementi */
    --radius-md: 10px;   /* bottoni, input, card piccole */
    --radius-lg: 16px;   /* card, modal, dropdown */
    --radius-xl: 24px;   /* glass-card, modal grande */
    --radius-full: 9999px; /* pill, avatar */
}
```

**Stato attuale**: 15+ valori distinti (4, 6, 8, 10, 12, 14, 16, 20, 24, 32px + 50%). Questa scala li riduce a 5.

---

## 7. Z-Index Scale

```css
:root {
    --z-base: 0;
    --z-sticky: 10;      /* elementi sticky (search bar) */
    --z-header: 100;     /* top-bar */
    --z-sidebar: 200;    /* sidebar (sopra header) */
    --z-dropdown: 500;   /* dropdown, select, notification */
    --z-overlay: 1000;   /* overlay scuro dietro modal/drawer */
    --z-drawer: 1100;    /* hub drawer */
    --z-modal: 1200;     /* modal standard */
    --z-system: 1300;    /* system modal (conferme critiche) */
    --z-toast: 1400;     /* toast notification */
    --z-splash: 9999;    /* splash screen (temporaneo) */
}
```

**Regola**: niente `99999`, niente `1000000`. Lo splash screen deve essere `display: none` dopo il fade, non restare nel DOM.

---

## 8. Strategia di migrazione proposta

### Fase 0 — Foundation (non rompe niente)

1. Creare `css/tokens.css` con tutte le variabili sopra
2. Importarlo come primo file in `main.css`
3. Nessun file esistente cambia

### Fase 1 — CSS component files (basso rischio)

Migrare i 19 file CSS component uno alla volta:
- Sostituire colori hardcoded con token
- Sostituire spacing hardcoded con token
- Unificare border-radius
- Risolvere duplicati (`homepage-alt.css` merge, `custom-select.css` merge)
- Aggiungere `@media` mancanti (agenda, bank, payments, auth, inputs)
- Fixare dark mode (sidebar mobile, top-bar mobile, agenda)

### Fase 2 — JS inline styles (alto effort, da fare incrementalmente)

Per ogni file JS, in ordine di priorita:
1. Estrarre gli inline styles in classi CSS
2. Sostituire colori hex con `var(--token)`
3. Sostituire breakpoint numerici con import da `breakpoints.js`
4. Sostituire max-width modal con classi (`.modal-sm`, `.modal-md`, `.modal-lg`)

Ordine suggerito: partire dai file NON caldi (sap_services.js, user_dashboard.js, contacts.js, suppliers_v2.js) per validare il pattern, poi affrontare i file caldi uno alla volta con coordinamento.

### Fase 3 — Structural

1. Aggiungere `#modal-root` al DOM
2. Centralizzare scroll lock e focus trap
3. Rimuovere `user-scalable=no` dal viewport meta
4. Rimuovere splash screen dal DOM dopo fade
5. Unificare z-index scale

---

## Nota finale

Questa proposta non aggiunge feature. E un piano per rendere coerente quello che gia esiste. Ogni fase e indipendente e puo essere eseguita senza rompere l'app in produzione.

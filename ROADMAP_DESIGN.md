# Roadmap Design System — Stato avanzamento

**Ultimo aggiornamento**: 15 maggio 2026 (sera)

## Step 1: Foundation + Quick Wins (completato 15/5/26)

| Area | Stato | % | Note |
|------|-------|---|------|
| `css/tokens.css` | DONE | 100% | Spacing, palette, typography, radius, z-index, breakpoints, backward-compat aliases |
| Agenda responsive (P0 #1) | DONE | 100% | @media 768px + 480px, layout 1-col, mini-cal impila |
| Agenda dark mode (P0 #2) | DONE | 100% | 7 selettori migrati da white → var() |
| Sidebar mobile dark (P0 #3) | DONE | 100% | background: white → var(--bg-card) |
| Top-bar mobile dark (P0 #3) | DONE | 100% | 3 hex hardcoded → var() |
| Notifications vars (P1 #6) | DONE | 100% | Alias in tokens.css, selector :root fix, breakpoint 768px |

## Step 2: CSS Component Migration (in corso)

| Area | Stato | % | Note |
|------|-------|---|------|
| Chat CSS syntax fix (P2 #9) | DONE | 100% | var(rgba()) → rgba(var()) |
| Buttons dark mode | DONE | 100% | .icon-btn:hover white → var(--bg-card), rimosso override dark |
| Auth responsive | DONE | 100% | @media 768px aggiunta (card, blobs, font-size) |
| Bank transactions responsive | DONE | 100% | @media 768px + 480px (KPI grid, transaction row, form) |
| Custom select dark mode | DONE | 100% | trigger hover white → var(--bg-card) |
| Z-index consolidamento | DONE | 100% | modal 99999→var(--z-modal), system 1M→var(--z-system), sidebar 20k→var(--z-drawer), overlay 99998→var(--z-overlay), notif dropdown 10k→var(--z-dropdown), toast 10001→var(--z-toast) |
| Semantic color tokens (modals/sidebar) | DONE | 100% | #ef4444 → var(--color-error) su close-modal, notification-badge, logout |
| Payments responsive | DONE | 100% | @media 768px aggiunta (info-grid, tab-btn) |
| Tables responsive + semantic | DONE | 100% | @media 768px, status-badge → semantic tokens, row bg → var() |
| Cards cleanup | DONE | 100% | Duplicate @media 768px merged, rgba(59,130,246) → rgba(var(--brand-blue-rgb)), fiscal-section → semantic |
| Inputs z-index + disabled | DONE | 100% | .select-dropdown 10000 → var(--z-dropdown), disabled generalizzato a tutti input/select/textarea |
| Homepage dark mode | DONE | 100% | 20+ hex hardcoded (#e5e7eb, white, #111, #64748b, #1e293b, #f8fafc, #e2e8f0) → var(), KPI status → semantic |
| Bank transactions semantic | DONE | 100% | income/expense → var(--color-success/error), ref-tag → semantic tokens |
| Sidebar drilldown tokens | DONE | 100% | rgba(78,146,216) → rgba(var(--brand-blue-rgb)) |
| Design-system cleanup | DONE | 100% | 7 utility duplicate rimossi, badges/icons → semantic, .success-btn → var(), backward-compat aliases |
| Notifications residui | DONE | 100% | 2 hex rimasti → var(--color-error) |
| Homepage CSS dedup (P1 #5) | BLOCKED | 0% | homepage-alt.css caricato dinamicamente da homepage-alt.js — richiede refactor JS |
| Custom select token migration | DONE | 100% | z-index 999 → var(--z-dropdown), rgba hardcoded → var(--brand-blue-rgb). Dedup wrapper richiede JS audit |
| Button system esteso | DONE | 100% | .danger/.success variants, .btn-sm/.btn-lg sizes, :focus-visible, :disabled |
| Splash screen cleanup (P3 #10) | TODO | 0% | display:none dopo fade (richiede JS) |

## Step 3: JS Inline Styles Migration (da fare)

| Area | Stato | % | Note |
|------|-------|---|------|
| Estrazione classi CSS da JS | TODO | 0% | 8.530 inline styles totali |
| Breakpoints.js modulo condiviso | TODO | 0% | Eliminare 10+ numeri magici |
| Modal size classes | TODO | 0% | .modal-sm/md/lg vs inline max-width |
| Colori hex → var() nei JS | TODO | 0% | 30+ colori, top 9 usati 100+ volte |

## Metriche globali

| Metrica | Prima (15/5/26) | Dopo Step 1 | Dopo Step 2 (parziale) | Target finale |
|---------|----------------|-------------|----------------------|---------------|
| Mobile responsive | ~40% viste | ~50% (+agenda) | ~70% (+auth, bank, payments, tables) | 100% |
| Design system unificato | ~15% | ~20% | ~60% (z-index, colori, radius, utility dedup su 18 file CSS) | 90%+ |
| Dark mode funzionante | ~60% viste | ~75% | ~95% (tutti file CSS migrati; residuo: homepage-alt BLOCKED, agenda event colors intenzionali) | 100% |
| Inline styles nei JS | 8.530 | 8.530 | 8.530 (non toccati — Step 3) | <500 |

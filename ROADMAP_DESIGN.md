# Roadmap Design System — Stato avanzamento

**Ultimo aggiornamento**: 15 maggio 2026

## Step 1: Foundation + Quick Wins (completato 15/5/26)

| Area | Stato | % | Note |
|------|-------|---|------|
| `css/tokens.css` | DONE | 100% | Spacing, palette, typography, radius, z-index, breakpoints, backward-compat aliases |
| Agenda responsive (P0 #1) | DONE | 100% | @media 768px + 480px, layout 1-col, mini-cal impila |
| Agenda dark mode (P0 #2) | DONE | 100% | 7 selettori migrati da white → var() |
| Sidebar mobile dark (P0 #3) | DONE | 100% | background: white → var(--bg-card) |
| Top-bar mobile dark (P0 #3) | DONE | 100% | 3 hex hardcoded → var() |
| Notifications vars (P1 #6) | DONE | 100% | Alias in tokens.css, selector :root fix, breakpoint 768px |

## Step 2: CSS Component Migration (da fare)

| Area | Stato | % | Note |
|------|-------|---|------|
| Homepage CSS dedup (P1 #5) | TODO | 0% | Merge homepage.css + homepage-alt.css |
| Custom select dedup (P2 #8) | TODO | 0% | Merge inputs.css + custom-select.css |
| Chat CSS syntax fix (P2 #9) | TODO | 0% | var(rgba()) invalido |
| Button system unificato | TODO | 0% | .btn + varianti + sizes + states |
| Auth responsive | TODO | 0% | @media mancanti |
| Bank transactions responsive | TODO | 0% | @media mancanti |
| Payments breakpoint fix (P2 #7) | TODO | 0% | 1024 → 768 |
| Z-index consolidamento | TODO | 0% | Migrare a --z-* scale |
| Splash screen cleanup (P3 #10) | TODO | 0% | display:none dopo fade |

## Step 3: JS Inline Styles Migration (da fare)

| Area | Stato | % | Note |
|------|-------|---|------|
| Estrazione classi CSS da JS | TODO | 0% | 8.530 inline styles totali |
| Breakpoints.js modulo condiviso | TODO | 0% | Eliminare 10+ numeri magici |
| Modal size classes | TODO | 0% | .modal-sm/md/lg vs inline max-width |
| Colori hex → var() nei JS | TODO | 0% | 30+ colori, top 9 usati 100+ volte |

## Metriche globali

| Metrica | Prima (15/5/26) | Dopo Step 1 | Target finale |
|---------|----------------|-------------|---------------|
| Mobile responsive | ~40% viste | ~50% viste (+agenda) | 100% |
| Design system unificato | ~15% (token definiti, non usati) | ~20% (token + alias + 4 file migrati) | 90%+ |
| Dark mode funzionante | ~60% viste | ~75% (+agenda, sidebar, top-bar, notifiche) | 100% |
| Inline styles nei JS | 8.530 | 8.530 (non toccati) | <500 |

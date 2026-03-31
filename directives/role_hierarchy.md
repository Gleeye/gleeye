# Gerarchia Ruoli — Gleeye Workspace

## Principio fondamentale

**I ruoli NON si escludono a vicenda.** Un utente può avere più ruoli contemporaneamente. Quando un utente ha ruoli multipli, si applica sempre il privilegio più alto.

## Ruoli esistenti

| Ruolo | Dove vive | Descrizione |
|-------|-----------|-------------|
| `admin` | `profiles.role` | Ruolo tecnico. Solo per chi sviluppa l'app. Non è un ruolo business. |
| `partner` | `collaborators.tags` | Massimo privilegio business. Socio dell'agenzia. |
| `amministrazione` | `collaborators.tags` | Accesso completo alla parte amministrativa/finanziaria. |
| `account` | `collaborators.tags` | Gestione commerciale, clienti, commesse. |
| `project manager` | `collaborators.tags` | Gestione operativa dei progetti e del team. |

## Gerarchia (dal più alto al più basso)

```
admin (tecnico)
    ↓
partner
    ↓
amministrazione
    ↓
account
    ↓
project manager
    ↓
collaboratore (nessun tag speciale)
```

## Regola critica per il codice

Quando si controlla se mostrare contenuti privilegiati (es. alert amministrazione, dashboard finanziaria, ecc.), la logica corretta è:

```js
// ✅ CORRETTO — priorità al ruolo più alto
const isTrueAdmin =
    normalizedTags.includes('partner') ||
    normalizedTags.includes('amministrazione') ||
    state.profile?.role === 'admin';

const isAccountOnly = !isTrueAdmin && normalizedTags.includes('account');
const isPmOnly = !isTrueAdmin && (normalizedTags.includes('project manager') || normalizedTags.includes('pm'));
```

```js
// ❌ SBAGLIATO — esclude chi ha ruoli multipli
const isAccountOrPM = normalizedTags.includes('account') || normalizedTags.includes('project manager');
const isAdmin = (normalizedTags.includes('partner') || ...) && !isAccountOrPM;
// → Se l'utente ha sia "partner" che "account", isAdmin = false. ERRATO.
```

## Esempio reale: Davide Gentile

Tags: `["Account", "Amministrazione", "Partner", "Project Manager"]`
Profile role: `admin`

Con la logica corretta:
- `isTrueAdmin = true` (ha partner + amministrazione + app admin)
- Vede: alert amministrazione, dashboard finanziaria, accesso completo
- I tag `account` e `project manager` arricchiscono la sua vista (es. vede anche le sue commesse come account), ma NON riducono i suoi privilegi admin

## Impersonazione

Quando si usa il tool di impersonazione (`state.impersonatedCollaboratorId`), il ruolo visualizzato deve essere quello dell'utente impersonato, NON di chi ha fatto login. In particolare:

```js
// ❌ SBAGLIATO in modalità impersonazione
if (state.profile?.role === 'admin') { /* forza vista admin */ }

// ✅ CORRETTO
const isImpersonating = !!state.impersonatedCollaboratorId;
if (!isImpersonating && state.profile?.role === 'admin') { /* forza vista admin */ }
```

## Dove si usa questa logica nel codice

- `js/features/homepage-alt.js` — rilevamento ruolo per la home (`detectUserRole`, `renderMainContent_Partner`, `renderAdminAlerts`)
- `js/modules/router.js` — access control per le pagine
- `js/features/auth.js` — visibilità sidebar e redirect al login
- `js/features/layout.js` — visibilità voci di menu

## Nota su "collaboratore semplice"

Un collaboratore senza nessuno dei tag speciali sopra elencati è un "collaboratore semplice". Vede solo: home personale, agenda, le sue task, i suoi incarichi, chat, booking.

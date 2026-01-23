# Knowledge Base - Session 2026-01-23/24

Questo file contiene una sintesi delle modifiche strutturali, dei fix e delle decisioni tecniche prese durante la sessione, per garantire coerenza nei futuri interventi.

## 1. Agenda UI & Layout
- **Manage Availability**: Spostato da un tasto ingombrante nella sidebar a un'icona pulita (calendario con spunta blu) nell'intestazione destra dell'agenda (`#btn-manage-availability`).
- **Sidebar Scrolling**: Risolto il blocco dello scrolling nella barra laterale dell'agenda. Implementato `overflow-y: auto` e vincoli di altezza (`calc(100vh - 120px)`) sul container principale (`.agenda-container`) e sulla sidebar (`.agenda-sidebar`) per evitare che il contenuto venga tagliato su schermi piccoli.
- **Cache Busting**: Utilizzato `?v=999` (o superiore) negli import CSS in `index.html` per forzare il refresh degli stili in produzione.

## 2. Gestione Fuso Orario (Timezones)
- **Impostazioni Utente**: Aggiunto un selettore di Timezone nel Profilo Utente (`#profile`).
- **Logica di Disponibilità**: 
    - L'app Booking ora tiene conto della timezone del singolo collaboratore durante il calcolo degli slot disponibili.
    - Le Edge Functions (`check-google-availability`) leggono la timezone dal database per convertire correttamente gli eventi Google (UTC) in orari locali e viceversa.

## 3. Booking Hub (Funzionalità Admin)
- **Sezione "Prossimi"**: Sostituita la vista "Oggi" con una lista "Prossimi Appuntamenti" che mostra i prossimi 20 eventi futuri in ordine cronologico.
- **Dettagli Appuntamento**: Le card ora mostrano prioritariamente il **Nome Azienda** (Company), seguito dal nome del referente e dal tipo di servizio.
- **Fix Rendering**: Risolto un bug che causava una schermata bianca (dovuto a `type-only imports` incompatibili con la configurazione TSC/Vite).

## 4. Google Calendar Sync
- **Fix 401 Unauthorized**: La Edge Function `check-google-availability` è stata deployata con `--no-verify-jwt` per permettere la chiamata sia dall'ambiente locale che dal nuovo deploy cloud, gestendo internamente la logica di refresh token tramite `system_config`.
- **Credenziali**: La funzione tenta prima di leggere `google_client_id` e `google_client_secret` dalla tabella `system_config`, con fallback sulle variabili d'ambiente di Supabase.

## 5. Deployment Info
- **Frontend**: Repository GitHub `Gleeye/gleeye`.
- **Edge Functions**: Deployate su progetto Supabase `whpbetjyhpttinbxcffs`.
    - Commando: `supabase functions deploy check-google-availability --no-verify-jwt`

---
*Ultimo aggiornamento: 24 Gennaio 2026, 00:05*

# Google Calendar Sync Architecture

Questo file descrive il funzionamento tecnico della sincronizzazione tra Gleeye ERP e Google Calendar, per Reference futura e manutenzione.

## 1. Componenti Principali
- **Edge Function**: `check-google-availability` (Supabase).
- **Tabella Auth**: `collaborator_google_auth` (contiene access_token, refresh_token, scadenza e calendari selezionati).
- **Tabella Config**: `system_config` (contiene `google_client_id` e `google_client_secret`).

## 2. Flusso di Autenticazione & Refresh
La funzione Edge implementa una logica di refresh automatico:
1. Verifica se il `access_token` nel database è scaduto (`expires_at`).
2. Se scaduto, recupera le credenziali (ID e Secret) dalla tabella `system_config`.
3. Effettua la richiesta di refresh a Google OAuth2.
4. Aggiorna il database con il nuovo token e la nuova scadenza.
5. Procede con la richiesta dei dati (FreeBusy API).

## 3. Sicurezza & JWT
**IMPORTANTE**: La funzione è deployata con il flag `--no-verify-jwt`.
- **Perché**: Le chiamate arrivano da domini diversi (localhost, deploy cloud) e l'applicazione gestisce l'autorizzazione basandosi sul `collaborator_id` fornito nel body.
- **Accesso DB**: La funzione usa il `SUPABASE_SERVICE_ROLE_KEY` per poter leggere le tabelle di config e procedere ai refresh senza restrizioni di RLS imposte dall'utente finale.

## 4. Gestione Timezone
- La funzione recupera la timezone del collaboratore dalla tabella `profiles`.
- I dati FreeBusy di Google sono restituiti in UTC.
- Il frontend/motore di calcolo converte questi slot in "ore locali" basandosi sulla timezone salvata nel profilo per determinare se un collaboratore è effettivamente occupato durante il suo orario di lavoro locale.

## 5. Comandi Utili
Per aggiornare la funzione in produzione:
```bash
supabase functions deploy check-google-availability --no-verify-jwt
```

## 6. Risoluzione Problemi (401 Unauthorized)
Se la sincronizzazione fallisce con 401:
1. Verificare che i record in `system_config` siano presenti e corretti.
2. Controllare che il record `collaborator_google_auth` per l'utente non sia stato revocato lato Google.
3. Assicurarsi che il deploy sia stato fatto con `--no-verify-jwt`.

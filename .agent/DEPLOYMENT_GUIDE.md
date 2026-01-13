# Gleeye ERP - Deployment & Workflow Guide

Questo documento serve a coordinare lo sviluppo ora che l'applicazione è **LIVE** su Vercel e GitHub.

## 🚀 Stato della Distribuzione
L'applicazione è configurata in modalità **Organizzazione Monorepo** su GitHub e distribuita su due progetti Vercel separati:

- **Repository GitHub**: `https://github.com/Gleeye/gleeye.git`
- **ERP Principale (Frontend)**: `https://gleeye.vercel.app` (Radice del repo)
- **Booking App (React)**: `https://gleeyebooking.vercel.app` (Cartella `/booking-app`)

## 🛠 Workflow di Sviluppo (Mandatorio)
D'ora in poi, ogni modifica deve seguire questo flusso per garantire che l'app online sia sempre aggiornata:

1.  **Modifica Locale**: Apportare le modifiche ai file nella cartella di lavoro.
2.  **Git Commit & Push**: Eseguire SEMPRE il push sul branch `main` dopo ogni modifica significativa.
    ```bash
    git add .
    git commit -m "Descrizione modifica"
    git push origin main
    ```
3.  **Auto-Deploy**: Vercel rileverà il push e aggiornerà automaticamente i siti (entrambi).

## ⚠️ Note Tecniche Importanti

### 1. Variabili d'Ambiente (Secrets)
**NON caricare mai segreti (Chiavi Google, DB Password, ecc.) su GitHub.**
- I segreti di Google OAuth sono gestiti tramite la tabella `public.system_config` su Supabase.
- Le chiavi di Supabase per la Booking App sono configurate come **Environment Variables** direttamente sulla dashboard di Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### 2. Integrazione Iframe
L'ERP carica la Booking App tramite un iframe nel file `js/features/booking.js`. 
Il sistema riconosce automaticamente se sei in locale o online:
- In locale punta a `http://localhost:5173`.
- Online punta a `https://gleeyebooking.vercel.app`.

### 3. Compilazione React (Booking App)
Se la build della Booking App fallisce su Vercel, è probabile che TypeScript abbia rilevato errori (anche solo variabili non usate). Risolvere sempre i warning in `booking-app/src` prima di fare il push.

---
*Documento aggiornato il 13/01/2026 dal Team AI.*

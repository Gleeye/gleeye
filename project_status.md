# Stato del Progetto "Gleeye ERP"

## Obiettivi Recenti
Questo file riassume lo stato dei lavori e i piani recenti discussi con l'assistente AI, per facilitare la continuazione del lavoro su un altro account.

### 1. Miglioramento Sezione Collaboratori
*   **Obiettivo**: Rinominare "Dipendenti" in "Collaboratori" e migliorare la UI.
*   **Dettagli**:
    *   Sostituire testo email/telefono con icone shortcut.
    *   Aggiungere "Magic Link" per invito rapido.
    *   Implementare filtri per dipartimento/ruolo.

### 2. UI CRM e Migrazione Fatture
*   **Obiettivo**: Ristrutturare il CRM e migrare i dati delle fatture.
*   **Dettagli**:
    *   Navigazione nidificata per Clienti e Referenti sotto un'unica voce.
    *   Script di importazione per "Fatture Attive.csv".
    *   Creazione schemi database per fatture e dati finanziari.

### 3. Brand Identity & UI Design
*   **Obiettivo**: Nuova identità visiva.
*   **Specifiche**:
    *   **Font**: Poppins (titoli), Questrial (testo).
    *   **Colori**: Blue Dart, Viola Studio.
    *   **Stile**: Soft UI, Glassmorphism, bordi arrotondati.
    *   **Tema**: Supporto Dual Dark/Light mode.

### 4. Note Tecniche
*   I file SQL di importazione (`import_contacts.sql`, `import_clients.sql`, ecc.) sono presenti nella root.
*   Script Python di generazione (`generate_import_...`) sono presenti per rigenerare i SQL se necessario.

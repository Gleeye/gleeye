---
description: "SOP e regole di traduzione per il log delle attività (Activity Feed)"
---

# Regole di formattazione e traduzione PM Activity Logs

Questo file serve come repository vivente delle regole da applicare ovunque si mostrino i log delle attività (es. `homepage.js`, `activity_log.js`), tramite l'helper unificato `pm_activity_helper.js`.
Il sistema deve consultare questo file prima di modificare l'activity feed.

## Problemi Comuni e Regole di Risoluzione (Da applicare in Helper)

1. **Ripetizione del nome (Entity vs Container):**
   - **Errore:** "Davide Gentile ha creato [Nome Commessa] in [Nome Commessa]"
   - **Regola:** Se `entityName` è esattamente uguale a `containerName`, `containerRef` non deve essere mostrato. L'informazione "in [Nome]" è ridondante. 

2. **Diciture generiche:**
   - **Errore:** "Davide Gentile ha creato questa attività"
   - **Regola:** Se l'entità referenziata è andata persa o è una fallback generica (es. "questa attività", "una risorsa"), e abbiamo il `containerName`, la stringa dovrebbe essere più fluida: es. "ha aggiunto un'attività in **[Nome Contenitore]**", senza mettere in grassetto paroloni inutili come "una risorsa".

3. **Inerzia dei Log Multipli:**
   - **Problema:** Appaiono 3 o 4 log identici allo stesso orario (es. "Sistema ha creato Progetto...").
   - **Causa:** Il database genera più log dello stesso evento (es. un trigger si attiva per `INSERT`, poi un altro trigger per `UPDATE` sullo status senza diff corretti, o record duplicati in `pm_activity_logs`).
   - **Azione Attesa:** Il frontend dovrebbe deduplicare i log visivamente se sono consecutivi, stesso autore, stessa azione e stesso minuto, in attesa di fix radicali lato database.

## Dizionario di Mappatura Stati (activityVocabulary)
- `todo` -> "Da Fare"
- `in_progress` -> "In Corso"
- `blocked` -> "Bloccato"
- `review` -> "In Revisione"
- `done` -> "Completata"
- `attivita` -> "Attività"
- `task` -> "Task"

*Questo file verrà aggiornato man mano che il cliente fornirà nuove spiegazioni sulle diverse viste.*

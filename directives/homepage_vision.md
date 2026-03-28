# Direttiva: Visione e Scopo della Homepage (`#home-alt`)

## Filosofia di Base

La homepage è uno strumento di **lavoro quotidiano**, non una dashboard di analytics. 
Deve risolvere la complessità orizzontale dell'app (molte aree di business in egual misura importanti) offrendo a ogni utente **un punto di accesso immediato e contestualizzato** a ciò che lo riguarda.

L'utente apre l'app la mattina: la homepage lo orienta in 3 secondi su cosa fare, cosa monitorare, dove andare.

---

## Principi Chiave

1. **Contestuale al Ruolo**: Ogni sezione appare solo se rilevante per il profilo dell'utente.
2. **Azione > Informazione**: Priorità ai contenuti che richiedono un'azione (cose in scadenza, task assegnati, alert operativi), non ai dati di reportistica.
3. **Shortcut Efficaci**: La home è un acceleratore, non un duplicato delle sezioni interne.
4. **Velocità di Lettura**: Ogni widget deve essere scansionabile in < 5 secondi.

---

## Layout (2 Colonne)

```
|--- Sidebar 25% ---|-------- Main Content 75% --------|
| Calendario/Agenda | [Widget A] [Widget B] [Widget C] |
| Tasks assegnati   |                                  |
```

---

## Widget per Ruolo

### Sidebar (Comune a tutti)
- **Agenda/Calendario**: Vista sui prossimi eventi con filtri Oggi/Domani/Settimana. Sempre presente.
- **Le mie Task**: Lista dei task assegnati all'utente loggato, con stato e priorità.

### Main Content - Slot A: Le mie Commesse (solo PM)
- Visibile a chi è Project Manager di almeno una commessa attiva ("In Svolgimento").
- Funzione: **shortcut rapido**. Un PM rientra molte volte al giorno nelle sue commesse → la home riduce i click.
- Mostra: Codice cliente (breve), numero commessa, titolo, link diretto.
- NON mostra: Percentuali di avanzamento, barre di progresso, dettagli economici.
- Filtro: Solo commesse dove l'utente è PM (role: pm/project/manager/responsabile). 
- Status: Solo state "In Svolgimento" / "In Corso".

### Main Content - Slot B: Attività Recenti (filtrate per ruolo)
- Funzione: Feed di log delle attività nell'ERP, **filtrato per rilevanza personale**.
- **Collaboratore semplice**: Solo attività nelle commesse/task a cui è assegnato.
- **Project Manager**: Attività nelle sue commesse.
- **Account**: Attività dei clienti/commesse che segue.
- **Amministrazione**: Solo attività di area amministrativa/contabile.
- **Partner/Admin**: Tutto. Nessun filtro.
- Scopo: Sapere "cosa è successo di mio mentre non c'ero".

### Main Content - Slot C: Alert Amministrativi (solo Amministrazione)
- Visibile a chi ha tag `Amministrazione` (o ruolo admin).
- Funzione: **Stella polare operativa**. Non dati economici, ma **segnali di allerta e cose da fare**.
- Esempi di contenuto:
  - "X fatture attive non sono state ancora emesse per commesse completate"
  - "X compensi di collaboratori in scadenza questa settimana"
  - "X fatture passive senza corrispondenza in banca (non riconciliate)"
  - "X contratti in scadenza entro 30 giorni"
  - "X commesse completate senza fattura emessa"
- Formato: Lista di alert prioritari, cliccabili, che portano alla sezione relativa.
- NON è: Una dashboard con grafici o KPI economici aggregati (quelli stanno nelle dashboard dedicate).

---

## Roadmap Widget Futuri

- **Slot D (futuro)**: "Nuove richieste / Preventivi in attesa" → visibile agli Account.
- **Slot E (futuro)**: "Pagamenti in arrivo questa settimana" → visibile all'Amministrazione.
- **Slot F (futuro)**: "Stato server/infrastruttura" → visibile agli Admin tecnici.

---

## Note Tecniche

- Il riconoscimento del ruolo si basa su `state.profile.tags` (array di stringhe).
- I principali tag attesi: `['Partner', 'Amministrazione', 'Account', 'Project Manager']`.
- Gli utenti con ruolo `admin` nel DB vedono sempre tutto.
- La funzione principale di rendering è `renderHomepageAlt` in `js/features/homepage-alt.js`.
- I dati vengono caricati da `fetchRecentProjects` e `syncHomepageActivities`.

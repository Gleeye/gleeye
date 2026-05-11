# `scripts/archive/`

Archivio dei 253 script one-off accumulati nella root del progetto durante lo sviluppo con Antigravity (gennaio–aprile 2026).

Sono stati spostati qui in blocco per liberare la root del progetto e ridurre il rumore. Nessuno di questi file è referenziato dai file di produzione (`index.html`, `sw.js`, `vercel.json`, `package.json`, `manifest.json`) o dal codice in `js/`.

## Categorie principali

- **`check_*` / `inspect_*` / `count_*` / `get_*` / `list_*` / `peek_*` / `find_*`**: script di diagnostica una tantum (lettura del DB, ispezione struttura, ecc.).
- **`debug_*` / `tmp_*` / `temp_*` / `query_debug.py`**: utility di debug fatte sul momento.
- **`fix_*`**: script per correggere dati malformati (categorie, status, ecc.) ad hoc.
- **`apply_*` / `migration_*` / `create_*.sql` / `update_*.sql` / `ensure_*` / `execute_*`**: micro-migration applicate manualmente prima di passare al sistema `supabase/migrations/`. La fonte canonica oggi sono i file in `supabase/migrations/`.
- **`generate_import_*.py` / `import_*.sql` / `analyze_*.py`**: import storici da Airtable (vedi anche `tabelle_airtable/`).
- **`schema_dump*.sql` / `schema_full.sql` / `dump.sql` / `collaborators_dump.sql`**: dump storici del DB.
- **`setup_*` / `seed_*` / `init_*` / `bump_*`**: setup una tantum.
- **`test_*` / `insert_test*`**: prove e test.
- **`repair_*` / `recover_*` / `restore_*` / `reset_*` / `reprocess_*` / `attempt_*`**: rimedi a problemi specifici.
- **`sync_*` / `migrate_*` / `cleanup_*` / `direct_*` / `node_*` / `remote_*` / `run_*` / `verify_*` / `upgrade_*` / `reload_*`**: utility varie.
- **Orphan**: `0`, `24-0008-29C94`, `tmp.db`, `schema.sql` (vuoto), `migration_backup.sql` (vuoto), `migration_v2.sql`, `schema_database_airtable_gleeye` (artefatti).

## Politica futura

- **Non aggiungere nulla qui** durante lo sviluppo normale. Per script di diagnostica/debug puntuali, mettili in `scripts/` (al di fuori di `archive/`) e cancellali quando hanno finito il loro scopo, oppure trasformali in test riutilizzabili.
- **Migration al DB** vanno in `supabase/migrations/` con il timestamp ufficiale, non come file SQL sciolti in root.
- **Periodicamente** si può valutare se qualcosa qui dentro è davvero morto e cancellarlo del tutto (per ora si tiene perché git history pesa zero su disco aggiuntivo e non urge).

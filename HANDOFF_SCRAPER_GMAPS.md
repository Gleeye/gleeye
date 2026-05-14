# Handoff — Google Maps Scraper self-built

> Spec di lavoro per una sessione Claude cowork dedicata. Davide ha approvato il 15/5/26: costruiamo internamente lo scraper Google Maps invece di pagare Apify/Outscraper. Stack: VPS Hetzner + Puppeteer-stealth + proxy residenziali Smartproxy. Costo target operativo €25-35/mese.

## Contesto rapido (leggi prima di tutto)

Sei una sessione Claude in cowork con la sessione principale di Davide. La principale sta lavorando sul Sales Engine di Gleeye ERP (app gestionale agency Genova). Devi costruire un **microservizio di scraping Google Maps** che integri Gleeye dando volumi 5.000-15.000 place/giorno a costi €25-35/mese.

**Memoria condivisa**: leggi `/Users/davidegentile/.claude/projects/-Users-davidegentile-Documents-app-dev-gleeye-erp/memory/MEMORY.md` per il contesto generale. In particolare:
- `kb_processo_vendita.md` — perché esiste questo scraper (sistema 🅐 Ricerca Prospect)
- `sales_problema_arricchimento.md` — il dolore di Davide su scraping povero
- `strategy_vincoli_reali_gleeye.md` — vincoli reali Gleeye (Liguria + remote + volume)
- `reference_supabase_access.md` — credenziali Supabase

## Obiettivo

Edge function (o piccolo servizio HTTP) che Gleeye chiama con:
```
POST /scrape-gmaps
{ "query": "software house", "city": "Milano", "max_results": 200 }
```

E restituisce in 5-15 minuti:
```
[
  {
    "name": "...",
    "google_place_id": "...",
    "address": "...",
    "phone": "...",
    "website": "...",
    "rating": 4.5,
    "reviews_count": 87,
    "opening_hours": {...},
    "categories": ["..."],
    "lat": 45.4, "lng": 9.1,
    "scraped_at": "2026-05-15T..."
  }, ...
]
```

I prospect vanno inseriti direttamente nella tabella `prospects` di Supabase usando lo stesso payload format già in uso (vedi `js/features/sales/sourcing.js` linee 397-422 nel worktree).

## Stack richiesto

- **VPS**: Hetzner Cloud CX22 (2 vCPU, 2GB RAM, €5/mese). Setup Docker o nativo Node.js.
- **Linguaggio**: Node.js 20+ con TypeScript opzionale.
- **Browser**: Puppeteer con `puppeteer-extra` + `puppeteer-extra-plugin-stealth` (maschera l'essere headless da Google bot detection).
- **Proxy**: Smartproxy residenziali starter (~€15/mese, 5GB traffico). Configurazione via SOCKS5 / HTTP proxy URL nel launch di Puppeteer.
- **CAPTCHA solver**: 2Captcha account (gratis registrazione, top-up €5 copre mesi). Usato solo se proxy fallisce raramente.
- **Coda di job**: semplice tabella `gmaps_scrape_jobs` su Supabase (status: pending/running/done/failed) + polling worker. NIENTE Redis per ora.
- **API endpoint**: HTTPS via Caddy/nginx reverse proxy con cert Let's Encrypt automatico. Auth con bearer token semplice (un secret condiviso).

## Step di implementazione (suggeriti)

1. **Setup VPS Hetzner**: chiedi credenziali a Davide (lui apre l'account, ti dà SSH key). Installa Node 20 + npm + Caddy.
2. **Init progetto**: `npm init`, install `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `@supabase/supabase-js`, `express`, `dotenv`.
3. **Worker scraper** (`scraper.js`):
   - Lancia Chrome stealth con proxy.
   - Naviga a `https://www.google.com/maps/search/{encoded_query}+{city}/`.
   - Aspetta caricamento risultati (selector `[role="feed"]`).
   - Scrolla il pannello sinistro `[role="feed"]` finché non smette di aggiungere risultati (max N scroll, max max_results items).
   - Per ogni risultato: estrai nome, lat/lng, link Place ID dal href.
   - Per dettaglio ricco (telefono/sito/orari/recensioni): click sul card → aspetta pannello dettaglio → estrai.
   - Gestisci errori (timeout, CAPTCHA, IP banned) → segna job failed con motivo.
4. **API endpoint** (`server.js`):
   - `POST /scrape-gmaps` → insert in `gmaps_scrape_jobs` con status pending → return job_id.
   - `GET /scrape-gmaps/:job_id` → ritorna stato + risultati quando completi.
5. **Worker loop**: polling ogni 10 secondi su `gmaps_scrape_jobs WHERE status='pending'` → run scraper → update status + risultati → trigger insert in `prospects` Supabase con campo `ai_enrichment_data.source='google_maps'` + dati Place ID.
6. **Integrazione client**: in `js/features/sales/sourcing.js` di Gleeye, aggiungi seconda opzione "Google Maps" oltre a "OSM" nel modal sourcing. Quando l'utente sceglie GMaps: POST al tuo endpoint, poll status, mostra progress, alla fine insert dei prospect.

## Sicurezza

- Bearer token segreto in `.env` su VPS. Verifica header `Authorization: Bearer <token>` su ogni richiesta API.
- Mai loggare in console proxy credentials o token.
- Rate limit lato endpoint: max 10 job/ora per evitare runaway costi proxy.
- Anti-detection: variare user-agent, lingua `it-IT`, timezone Europe/Rome, viewport randomizzato 1280-1920×720-1080.

## Cose che ti aspetto faccia subito

1. Chiedi a Davide:
   - SSH access a VPS Hetzner (lo apre lui)
   - API key Smartproxy (apre account lui, ti passa credenziali)
   - URL della sua Supabase + service role key (vedi `reference_supabase_access.md` in memoria)
   - 2Captcha API key (opzionale, può aspettare il primo CAPTCHA)
2. Comincia da MVP: scraper + API endpoint che fa il primo test "software house Milano, 50 risultati". Quando torna dati puliti, scala a 200, poi integra Gleeye.
3. **Commit incrementali su un branch dedicato** `feature/gmaps-scraper`. NON toccare files che non c'entrano col tuo task. Read-only su tutto il resto del repo.

## Cosa NON fare

- NON eseguire scraping di Google Maps da localhost / IP residenziale di Davide (lo bannano subito).
- NON costruire UI personalizzata: il pannello già esiste nel modal sourcing, integra lì.
- NON modificare lo schema `prospects` esistente. Inserisci con la struttura attuale, source='google_maps' in `ai_enrichment_data`.
- NON usare Apify/Outscraper come fallback nascosto. Davide ha scelto self-built consapevolmente.

## Definition of done

- VPS deployato, scraper testato su 3 query reali (es. "software house Milano", "ristoranti Genova", "studi legali Torino"), ognuna restituisce ≥50 prospect arricchiti con rating + recensioni + sito + telefono nel 80%+ dei casi.
- API endpoint pubblico HTTPS, auth bearer, integrato in modal sourcing Gleeye.
- README con runbook (come ripartire dopo Google DOM change, come monitorare proxy budget, come scalare a 2 worker).
- Costi totali primo mese sotto €40 verificati.

## Note finali

Davide è frustrato dal "non potete farlo gratis". Tieni la barra alta: questo deve funzionare, non essere un esperimento. Se serve un secondo proxy provider per resilienza, dillo dopo aver testato il primo per 7 giorni. Se Google ti banna spesso, NON ridurre velocità a 1 query/minuto — investiga (probabilmente fingerprint scoperto, sistema stealth da affinare).

Buon lavoro. Resto disponibile per consult tramite condivisione del file MEMORY.md aggiornato.

# Sales Engine — architettura

**Fonte di verità del Sales Engine.** Aggiornare quando il modello cambia. Tutte le sessioni Claude leggono questo file prima di toccare l'area sales.

Ultimo aggiornamento: 2026-05-14

---

## Modello a 4 livelli

```
SETTORE (es. hospitality, food & wine)
   └─ NICCHIA (es. Strutture ricettive Liguria, Cantine Langhe)
        └─ PROSPECT (singola azienda)
             └─ SEND (singolo messaggio outreach)
```

Sopra ai SAP c'è la **tassonomia di mercato** (settore → nicchia). I SAP sono **trasversali**: alcuni sono agnostici (podcast da remoto), altri hanno declinazioni per settore (food photography), altri ancora declinazioni per nicchia (sito ristorante con booking vs sito cantina con e-commerce).

---

## SAP: modello rivisto

Un SAP NON è "un servizio per UN settore". È un'**identità** con declinazioni:

### Tabelle

- `core_services` (SAP base — esiste già)
  - Aggiungere: `target_sectors` jsonb array (vuoto/null = agnostico), `is_atomic_compositor` bool
- `core_service_variants` **NUOVA** — declinazioni di un SAP
  - Campi: id, sap_id, variant_name, target_sector_id?, target_niche_id?, marketing_pitch, atomic_services jsonb (array di service_atomic id), pricing_override numeric?, delivery_days_override int?
  - Una variante può essere **per settore** (es. "Sito food", "Sito hospitality") o **per nicchia** (es. "Sito ristorante stellato")
- `service_atomics` **NUOVA** — libreria moduli funzionali riutilizzabili
  - Esempi: `booking_tavoli`, `ecommerce_lite`, `menu_digitale`, `gallery`, `recensioni_widget`, `prenotazione_camere`, `eventi_calendar`, `podcast_template`, `lead_form_specialistico`, ecc.
  - Campi: id, name, description, est_delivery_days, prerequisites jsonb (altri atomics richiesti), category

### Match nicchia ↔ SAP

Algoritmo (usato da Niche Analyzer e Offer Builder):
1. Filtra SAP per `target_sectors` includendo il settore della nicchia (oppure agnostico)
2. Cerca variante più specifica disponibile: nicchia > settore > base
3. Estrae atomic_services della variante per costruire l'angle ("per il tuo ristorante il pacchetto include: menu digitale + booking tavoli + gallery")
4. Genera mock OTO formula usando il marketing_pitch della variante (non quello del SAP base)

---

## Tassonomia settori (seed)

Lista iniziale (modificabile a regime dalla UI o direttamente in DB):

| slug | nome | note |
|---|---|---|
| hospitality | Hospitality (hotel, B&B, agriturismi) | Liguria forte |
| food_wine | Food & Wine (ristoranti, cantine, gelaterie) | Cuore mercato Liguria |
| beauty_wellness | Beauty & Wellness (parrucchieri, estetisti, SPA) | |
| healthcare | Healthcare (medici, dentisti, veterinari, farmacie) | High ticket |
| professional_services | Servizi professionali (avvocati, commercialisti, architetti) | Ciclo vendita lungo |
| retail | Retail fisico (negozi, gioiellerie, ottici) | |
| tech_software | Tech & Software | Per i pochi SAP B2B tech |
| automotive | Automotive (concessionarie, officine) | |
| nautica | Nautica (cantieri, charter, broker) | Liguria edge |
| cultura_eventi | Cultura, eventi, musei, teatri | |
| fashion | Fashion / abbigliamento | |
| sport_fitness | Sport & Fitness (palestre, centri yoga) | |
| education | Education (scuole private, formazione) | |
| b2b_manufacturing | B2B manifatturiero/industriale | |

---

## Pipeline prospect: Layer 0 → 1 → 2

Ogni prospect attraversa tre layer di valutazione, in ordine crescente di costo.

### Layer 0 — Data completeness (deterministico, costo zero)

JavaScript puro, calcolato al sourcing/import. Score 0-100:

| Segnale | Punti | Note |
|---|---|---|
| Ha sito web raggiungibile | 25 | fetch 200 OK |
| Sito ha testo scrapabile (>500 char) | 15 | non solo immagini |
| Almeno 1 email pubblica trovata | 20 | regex su sito |
| Telefono pubblico | 10 | OSM/sito |
| Almeno 2 social profile attivi | 15 | FB/IG/LinkedIn |
| Rating Google >=3.5 con >=5 recensioni | 10 | quando disponibile |
| Aggiornamento sito/social ultimi 12 mesi | 5 | proxy "azienda viva" |

**Soglie**:
- `< 30`: incomplete → in coda "da arricchire manualmente" o droppato dopo retry
- `30-60`: parziale → passa al Layer 1 ma flag "dati parziali"
- `>= 60`: completo → analisi AI piena

### Layer 1 — Profilo AI base (~0.001€/prospect)

Solo per prospect con completeness >= 30. Gemini Flash Lite riceve in input il TESTO SCRAPATO + metadati. Output:
- 5 campi qualitativi (descrizione_lampo, chi_sono_cosa_fanno, prodotti_servizi, clientela_target, punto_distintivo)
- Campi strutturali specifici per settore (vedi schema_specific_fields sotto)
- promising_score 0-100 + rationale

### Layer 2 — Deep dive (~0.005€/prospect, auto se promising>=70)

Solo sui promettenti. Output: competitor, punti_forza, punti_debolezza, analisi_swot, news_recenti, testimonianze, opportunita_marketing, sap_candidati specifici, fattibilita_score.

### schema_specific_fields per settore

Quando il settore è noto, il Layer 1 estrae anche dati strutturati riusabili da filtri/segmentazione:

- **hospitality**: stelle, camere, fascia (luxury/mid/budget), location_type (centro/lungomare/collina), servizi (spa/parcheggio/ristorante/wifi), target_turistico (business/coppie/famiglie)
- **food_wine**: cucina_tipo, coperti, fascia_prezzo, location_type, servizi (asporto/delivery/eventi), specializzazione (pesce/carne/vegetariano/stellato)
- **beauty_wellness**: tipo (parrucchiere/estetista/spa), unisex_vs_specifico, servizi_principali
- **healthcare**: specializzazione, accetta_ssn, n_studi
- ...

Lista mantenuta in `js/features/sales/sector_schemas.js`.

---

## Sourcing: la regola del DB lean

**REGOLA CRITICA**: salviamo nel DB SOLO dati strutturati ed essenziali. Migliaia/decine di migliaia di aziende a regime → niente blob testuali, niente HTML, niente raw dumps.

### Cosa entra nel DB

- Dati strutturali del prospect (nome, email, telefono, indirizzo, sito, social URLs, P.IVA, rating Google + reviews_count)
- Output AI dei layer (campi qualitativi + strutturali per settore + score)
- Metadata sourcing (data, fonti utilizzate, completeness_score)

### Cosa NON entra nel DB

- HTML raw dei siti scrapati
- Testo completo body dei siti (>2KB)
- Liste di link/sub-pages
- Dump intermedi dello scraping

### Come gestiamo gli intermedi

- Scraping → estrazione → AI → salvataggio dell'output strutturato. Il testo grezzo VIVE in memoria durante la chain, MUORE dopo.
- Eventuale cache scraping con TTL 7gg per evitare re-scraping costoso (tabella separata `scraped_content_cache` con purge cron). Solo se servirà davvero.

### Stack scraping (gratis o quasi)

| Fonte | Costo | Cosa dà |
|---|---|---|
| OpenStreetMap Overpass | gratis illimitato | nome, indirizzo, sito (talvolta), telefono (50%) |
| Google Places API | 12K query/mese gratis ($200 credit) | nome, indirizzo, sito, telefono, rating, recensioni, categoria |
| Site scraping (edge fn scrape-prospect-site) | gratis | email, social, phones, contenuto testuale, meta |
| Social meta scraping | gratis | followers, ultimo post, tipologia contenuto (parsing JSON-LD del profilo) |
| Google search SERP | scraping diretto cauto / SerpAPI free tier | dettagli pubblici non altrove |

**Regola di completezza**: il sourcing non si ferma finché non ha tentato TUTTE le fonti gratuite. Solo dopo dichiara "incomplete".

---

## Bug e debiti tecnici aperti (sales engine)

| # | Descrizione | Priorità |
|---|---|---|
| 1 | Modal trasparenti — patch fatte ma serve un componente comune `buildOverlay/buildModalShell` riutilizzato OVUNQUE (anche `openProspectModal`, edit_step, sourcing_modal). Niente più copia-incolla del CSS overlay. | alta |
| 2 | Checkbox in `.np-row` (sezione prospect della nicchia) apre il modal del prospect anche cliccando la checkbox. `event.stopPropagation` su input non basta perché il listener click del div catches comunque. | alta |
| 3 | Pagina detail nicchia è "modal espanso a tutto schermo". Manca layout vero (gerarchia, tab interno, KPI compatti, lista prospect virtualizzata se >100). | alta |
| 4 | `geo_scope` (comuni nicchia) vive dentro l'analisi AI jsonb → ogni rianalisi sovrascrive il lavoro manuale di Davide. Spostare in campo separato e indipendente. | media |
| 5 | Sourcing OSM lascia email/social NULL anche quando il sito esiste. Non scatena scraping automatico al momento dell'import. | alta |
| 6 | Layer 1 enrichment estrae solo qualitativo, non i campi strutturali per settore. | alta |
| 7 | `last_scrape` salvato nel jsonb del prospect → viola la regola DB lean. Da rimuovere, scraping vive in memoria. | media |
| 8 | Modal `openProspectModal` di pipeline_board fixato in due fasi, ma il pattern di base copia-incolla → vedere bug #1. | media |

---

## Roadmap consolidamento (in ordine di esecuzione)

1. Migration `industry_sectors` (seed) + FK `outreach_niches.sector_id`
2. Migration `core_service_variants` + `service_atomics` (struttura, popolazione dopo)
3. Component condiviso `js/features/sales/_modal.js` con `openOverlayModal()` riutilizzato ovunque (chiude bug #1, #2, #8)
4. Layer 0 completeness scoring (deterministico, JS puro)
5. Sourcing aggressivo: scraping background al momento import, completeness al volo, no raw nel DB (chiude bug #5, #7)
6. Refactor Niche Analyzer per ricevere settore in input + tenere geo_scope separato (chiude bug #4)
7. Layer 1 con schema_specific_fields per settore (chiude bug #6)
8. Ridisegno pagina detail nicchia con layout vero (chiude bug #3)

Solo dopo: Re-launch Center, AWS SES sender, Lifecycle automation.

---

## Modello agenti

Ogni "agente" è una funzione JS che chiama Gemini Flash Lite con prompt strutturato. Niente magia, niente framework. Tutti centralizzati in `js/features/sales/agents/`:

- `niche_analyzer.js` — analizza nicchia (settore + nome → descrizione + criteri + pain + linguaggio + sap_candidati)
- `prospect_enricher.js` — Layer 1 + Layer 2 (input: prospect + scrape memoria → output: 5 campi + strutturali settore + score)
- `outreach_writer.js` — scrive template di step (input: nicchia + sap + step type + prev message → output: subject + body)
- *futuri*: `response_classifier`, `niche_hunter`, `performance_analyst`

Tutti usano `AI_MODELS.sales_drafter` = `google/gemini-2.5-flash-lite`. **Mai toccare `ai_client.js`**.

---

## Cost guard a regime

Stima a 10K prospect/anno con completeness ≥ 60 (50%):
- 5K Layer 1 × 0.001€ = **5€**
- 1.5K Layer 2 (30% promettenti) × 0.005€ = **7.5€**
- Sourcing: gratis (OSM + Google Places free tier + site scraping nostro)
- Sequence engine (futuro AWS SES): ~$1/mese a regime
- **Totale**: < 20€/anno per gestire 10K prospect arricchiti

A 100K prospect → ~200€/anno. Sostenibile per l'ordine di grandezza target.

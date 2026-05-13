/**
 * sales/sector_schema_builder.js
 * Genera lo SCHEMA DI ESTRAZIONE per ogni settore (UNA TANTUM, riusato per migliaia di prospect).
 *
 * Modello a 3 layer di estrazione runtime:
 * A) JSON-LD schema.org (deterministico, gratis)
 * B) Regex pattern italiani per i campi (deterministico, gratis)
 * C) AI extraction sul testo (fallback, solo se A+B non bastano, ~0.001€/prospect)
 *
 * Il Sector Schema Builder produce la lista campi+pattern UNA VOLTA per settore.
 * Lazy: getSectorSchema(sectorId) carica dal DB, genera se manca, ritorna.
 * Costo totale: ~1 cent per i 14 settori esistenti.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { supabase } from '../../modules/config.js?v=8001';

const MODEL = AI_MODELS.sales_drafter; // Gemini Flash Lite

// Cache in memoria (per non hammerare il DB durante una sessione)
const _schemaCache = new Map(); // sector_id → fields[]

/**
 * Carica lo schema per un settore. Se non esiste, lo genera e lo salva.
 * @param {object} sector - oggetto industry_sector con id, slug, name, description
 * @returns {Promise<Array>} fields array
 */
export async function getSectorSchema(sector) {
    if (!sector || !sector.id) throw new Error('sector mancante');

    if (_schemaCache.has(sector.id)) return _schemaCache.get(sector.id);

    // 1. Cerca nel DB
    const { data: existing, error: fErr } = await supabase
        .from('sector_extraction_schemas')
        .select('fields')
        .eq('sector_id', sector.id)
        .maybeSingle();
    if (fErr) console.warn('[SectorSchema] fetch error', fErr);

    if (existing && Array.isArray(existing.fields) && existing.fields.length > 0) {
        _schemaCache.set(sector.id, existing.fields);
        return existing.fields;
    }

    // 2. Non esiste → genera via AI
    console.log('[SectorSchema] generating for sector', sector.slug);
    const fields = await generateSchemaForSector(sector);

    // 3. Salva
    try {
        await supabase.from('sector_extraction_schemas').insert({
            sector_id: sector.id,
            fields,
            generated_by_model: MODEL,
        });
    } catch (err) {
        console.warn('[SectorSchema] save failed (proseguo con i fields generati)', err);
    }

    _schemaCache.set(sector.id, fields);
    return fields;
}

/**
 * Forza la rigenerazione (utile da UI admin se Davide vuole aggiornare).
 */
export async function regenerateSectorSchema(sector) {
    _schemaCache.delete(sector.id);
    const fields = await generateSchemaForSector(sector);
    await supabase
        .from('sector_extraction_schemas')
        .upsert({ sector_id: sector.id, fields, generated_by_model: MODEL, generated_at: new Date().toISOString() }, { onConflict: 'sector_id' });
    _schemaCache.set(sector.id, fields);
    return fields;
}

// ─── PRIVATE ──────────────────────────────────────────────────────────────────

async function generateSchemaForSector(sector) {
    const prompt =
        'Devi definire lo SCHEMA DI ESTRAZIONE DATI STRUTTURATI dal sito web di un\'azienda nel settore "' + sector.name + '" (slug: ' + sector.slug + ').\n' +
        (sector.description ? 'Descrizione settore: ' + sector.description + '\n' : '') +
        '\n' +
        'Output: array di 8-15 CAMPI ALTAMENTE INFORMATIVI per questo settore. Per ogni campo:\n' +
        '- key: snake_case (es. "stars", "rooms", "cucina_tipo")\n' +
        '- type: int | float | string | list_enum | bool\n' +
        '- json_ld_paths: array di path schema.org dove cercare il valore (es. ["starRating.ratingValue", "Hotel.starRating.ratingValue"]). Vuoto se non c\'è schema standard.\n' +
        '- regex_patterns: array di regex PCRE italiane per estrarre il valore dal testo del sito. Es. per stars: ["(\\\\d)\\\\s*stell[ae]", "★+"]. Vuoto se non applicabile.\n' +
        '- regex_keywords: { value: [keyword1, keyword2] } per list_enum. Es. per services hotel: {"spa": ["spa","wellness","centro benessere"], "pool": ["piscina","swimming pool"]}\n' +
        '- enum: array dei valori validi (solo per list_enum / enum)\n' +
        '- ai_question: domanda in italiano per estrazione AI fallback. Es. "Quante stelle ha l\'hotel?"\n' +
        '- category: "critical" (necessario per identificare la sotto-nicchia) | "important" | "nice_to_have"\n' +
        '\n' +
        'PRINCIPI:\n' +
        '1. Almeno 1 campo "critical" che permette di sotto-segmentare il settore (es. stars per hotel, cucina_tipo per ristoranti, specializzazione per studi medici).\n' +
        '2. Campi che SERVONO per outreach personalizzato (sapere come parlare al prospect).\n' +
        '3. Campi che si possono REALMENTE estrarre da un sito web italiano (es. numero dipendenti spesso NO, fascia prezzo dal listino SÌ).\n' +
        '4. Per servizi/feature usa list_enum con regex_keywords (più affidabile di AI extraction).\n' +
        '5. Includi SEMPRE rating_google (float) e reviews_count (int) come campi importanti (vengono da JSON-LD aggregateRating).\n' +
        '\n' +
        'Esempi per ispirazione (NON copiare, adatta al settore "' + sector.name + '"):\n' +
        '- Hospitality: stars, rooms, sub_category (hotel/bnb/agriturismo/resort/hostel), services (spa/pool/restaurant/parking/wifi/pet_friendly/gym), location_type (centro/lungomare/collina/campagna), target_audience (business/coppie/famiglie/luxury), price_range (budget/mid/luxury), rating, reviews_count\n' +
        '- Food & Wine: tipo_locale (ristorante/pizzeria/trattoria/osteria/enoteca/winebar), cucina_tipo (italiana/pesce/carne/vegetariana/etnica/stellato), coperti, fascia_prezzo, servizi (delivery/asporto/dehor/eventi/cantina), specialità, rating, reviews_count\n' +
        '- Healthcare: tipo_studio (medico/dentistico/veterinario/farmacia/poliambulatorio), specializzazioni, n_studi, accetta_ssn, servizi (urgenze/domicilio/teleconsulto), rating, reviews_count\n' +
        '\n' +
        'Risposta SOLO in JSON valido.';

    const schema = {
        fields: [
            {
                key: 'string',
                type: 'string',
                json_ld_paths: ['string'],
                regex_patterns: ['string'],
                regex_keywords: { example: ['string'] },
                enum: ['string'],
                ai_question: 'string',
                category: 'string',
            },
        ],
    };

    const result = await completeJSON(prompt, schema, {
        feature: 'sales_sector_schema_builder',
        model: MODEL,
        system:
            'Sei un esperto di data extraction da siti web italiani. Conosci schema.org, regex italiane, e i settori commerciali italiani. ' +
            'Definisci schemi di estrazione concreti, applicabili a siti web reali italiani. ' +
            'Rispondi SOLO in JSON valido.',
    });

    // Sanity: assicura array di field con almeno key/type
    const out = (result.fields || []).filter(f => f.key && f.type);
    return out;
}

/**
 * Pre-warming: chiama getSectorSchema su tutti i settori attivi
 * per popolare i 14 schemi una tantum. Utile da una pagina admin.
 */
export async function prewarmAllSectorSchemas() {
    const { data: sectors, error } = await supabase
        .from('industry_sectors')
        .select('id, slug, name, description')
        .eq('is_active', true);
    if (error) throw error;
    const results = [];
    for (const s of sectors || []) {
        try {
            const fields = await getSectorSchema(s);
            results.push({ sector: s.slug, fields_count: fields.length, ok: true });
        } catch (err) {
            results.push({ sector: s.slug, error: String(err?.message || err), ok: false });
        }
    }
    return results;
}

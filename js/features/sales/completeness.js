/**
 * sales/completeness.js
 * Layer 0 — Completeness Score deterministico per prospect.
 *
 * Calcolato in JS puro al sourcing/enrichment. Zero AI, zero token.
 * Decide chi passa al Layer 1 AI: <30 incomplete, 30-60 parziale, >=60 completo.
 *
 * Riferimento: sales_engine_architecture.md sezione "Layer 0".
 */

/**
 * Calcola completeness_score 0-100 da un prospect + (opzionale) dati di scraping freschi.
 *
 * @param {object} prospect - oggetto prospect DB
 * @param {object} [scrape] - risultato di scrape-prospect-site (in memoria)
 * @returns {{ score: number, label: 'incomplete'|'parziale'|'completo', breakdown: object }}
 */
export function computeCompleteness(prospect, scrape) {
    let score = 0;
    const breakdown = {};

    // 1. Sito web (anche solo URL valorizzato = +10, scraping riuscito = +25)
    if (prospect.website && /^https?:\/\//i.test(prospect.website)) {
        score += 10;
        breakdown.has_website_url = 10;
    }
    if (scrape && scrape.success) {
        score += 15;
        breakdown.site_scraped_ok = 15;
    }

    // 2. Testo del sito sostanzioso (>500 char)
    if (scrape && scrape.success && scrape.text && scrape.text.length > 500) {
        score += 15;
        breakdown.site_text_rich = 15;
    } else if (scrape && scrape.success && scrape.text && scrape.text.length > 100) {
        score += 5;
        breakdown.site_text_thin = 5;
    }

    // 3. Email (preferenza email da scrape, fallback su contact_email)
    const emailsFromScrape = scrape?.emails || [];
    if (emailsFromScrape.length > 0 || prospect.contact_email) {
        score += 20;
        breakdown.has_email = 20;
    }

    // 4. Telefono
    const phonesFromScrape = scrape?.phones || [];
    if (phonesFromScrape.length > 0 || prospect.contact_phone) {
        score += 10;
        breakdown.has_phone = 10;
    }

    // 5. Social (>=2 social profile)
    const scrapeSocials = scrape?.socials || {};
    const dbSocials = prospect.social_links || {};
    const allSocialKeys = new Set([
        ...Object.keys(scrapeSocials).filter(k => scrapeSocials[k]),
        ...Object.keys(dbSocials).filter(k => dbSocials[k]),
    ]);
    if (allSocialKeys.size >= 2) {
        score += 15;
        breakdown.social_2plus = 15;
    } else if (allSocialKeys.size === 1) {
        score += 7;
        breakdown.social_1 = 7;
    }

    // 6. Google rating decente (se disponibile in ai_enrichment_data.google_rating o simili)
    const e = prospect.ai_enrichment_data || {};
    if (e.google_rating && e.google_rating >= 3.5 && (e.google_reviews_count || 0) >= 5) {
        score += 10;
        breakdown.google_rating_good = 10;
    }

    // 7. Aggiornamento recente (proxy: meta description / scrape sample con date recenti, oppure manca → no +5)
    if (scrape && scrape.success && scrape.meta_description) {
        score += 5;
        breakdown.has_meta = 5;
    }

    score = Math.min(100, score);
    const label = score >= 60 ? 'completo' : score >= 30 ? 'parziale' : 'incomplete';
    return { score, label, breakdown };
}

/**
 * Helper per estrarre dal risultato dello scraping i campi strutturati che salveremo nel DB
 * (DB lean: NON salviamo HTML/testo raw, solo dati strutturati).
 *
 * @param {object} scrape - risultato scrape-prospect-site
 * @returns {object} campi da merge nell update del prospect (contact_email, contact_phone, social_links, ai_enrichment_data partial)
 */
export function extractLeanFieldsFromScrape(scrape, currentProspect) {
    const out = {};
    if (!scrape || !scrape.success) return out;

    // Email — solo se mancante sul prospect
    if (!currentProspect?.contact_email && scrape.emails && scrape.emails.length > 0) {
        out.contact_email = scrape.emails[0];
    }
    // Phone — solo se mancante
    if (!currentProspect?.contact_phone && scrape.phones && scrape.phones.length > 0) {
        out.contact_phone = scrape.phones[0];
    }
    // Social links — sempre aggiornati (sovrascrivono i precedenti se diversi)
    if (scrape.socials && Object.keys(scrape.socials).length > 0) {
        out.social_links = { ...(currentProspect?.social_links || {}), ...scrape.socials };
        // E linkedin separato sul prospect (campo esistente)
        if (!currentProspect?.linkedin_url && scrape.socials.linkedin) {
            out.linkedin_url = scrape.socials.linkedin;
        }
    }

    out.last_enriched_at = new Date().toISOString();
    return out;
}

/**
 * Calcola completeness e prepara payload di update completo (Layer 0 + lean fields).
 * Usato dal Sourcing aggressivo e dal bulk analyze.
 *
 * NON salva il testo grezzo dello scrape. Quello vive in memoria, va all'AI, muore.
 */
export function buildLeanUpdatePayload(prospect, scrape) {
    const completeness = computeCompleteness(prospect, scrape);
    const leanFields = extractLeanFieldsFromScrape(scrape, prospect);

    return {
        ...leanFields,
        completeness_score: completeness.score,
    };
}

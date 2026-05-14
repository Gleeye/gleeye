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

    // 1. Sito web
    if (prospect.website && /^https?:\/\//i.test(prospect.website)) {
        score += 10;
        breakdown.has_website_url = 10;
    }
    if (scrape && scrape.success) {
        score += 12;
        breakdown.site_scraped_ok = 12;
    }
    // Multi-pagina bonus
    if (scrape && scrape.success && Array.isArray(scrape.pages_scraped) && scrape.pages_scraped.length >= 2) {
        score += 5;
        breakdown.multi_page_scraped = 5;
    }

    // 2. Testo del sito ricco
    if (scrape && scrape.success && scrape.text && scrape.text.length > 2000) {
        score += 12;
        breakdown.site_text_rich = 12;
    } else if (scrape && scrape.success && scrape.text && scrape.text.length > 500) {
        score += 8;
        breakdown.site_text_medium = 8;
    } else if (scrape && scrape.success && scrape.text && scrape.text.length > 100) {
        score += 3;
        breakdown.site_text_thin = 3;
    }

    // 3. Email — distinzione tra info@ generica e referente specifico
    const emailsFromScrape = scrape?.emails || [];
    const referenti = scrape?.emails_referenti || [];
    if (referenti.length > 0) {
        score += 22;
        breakdown.has_email_referente = 22;
    } else if (emailsFromScrape.length > 0 || prospect.contact_email) {
        score += 15;
        breakdown.has_email = 15;
    }
    // Bonus email multiple (più contatti tentabili)
    if (emailsFromScrape.length >= 2) {
        score += 3;
        breakdown.email_multiple = 3;
    }

    // 4. Telefono
    const phonesFromScrape = scrape?.phones || [];
    if (phonesFromScrape.length > 0 || prospect.contact_phone) {
        score += 8;
        breakdown.has_phone = 8;
    }

    // 5. Social
    const scrapeSocials = scrape?.socials || {};
    const dbSocials = prospect.social_links || {};
    const allSocialKeys = new Set([
        ...Object.keys(scrapeSocials).filter(k => scrapeSocials[k]),
        ...Object.keys(dbSocials).filter(k => dbSocials[k]),
    ]);
    if (allSocialKeys.size >= 3) {
        score += 13;
        breakdown.social_3plus = 13;
    } else if (allSocialKeys.size >= 2) {
        score += 10;
        breakdown.social_2 = 10;
    } else if (allSocialKeys.size === 1) {
        score += 5;
        breakdown.social_1 = 5;
    }

    // 6. JSON-LD presence (segnale di sito ben strutturato + dati gratis ricchi)
    if (scrape && scrape.json_ld && Object.keys(scrape.json_ld).length > 0) {
        score += 5;
        breakdown.has_json_ld = 5;
    }

    // 7. Rating Google (da JSON-LD aggregateRating)
    const e = prospect.ai_enrichment_data || {};
    const ratingFromScrape = getAggregateRating(scrape);
    const rating = (ratingFromScrape?.ratingValue) || e.google_rating;
    const reviewsCount = (ratingFromScrape?.reviewCount) || e.google_reviews_count || 0;
    if (rating && Number(rating) >= 3.5 && Number(reviewsCount) >= 5) {
        score += 8;
        breakdown.google_rating_good = 8;
    } else if (rating) {
        score += 3;
        breakdown.has_rating = 3;
    }

    // 8. Structured fields critici riempiti (sub_category + 2+ campi)
    const structured = scrape?.structured_fields || {};
    const filledCount = Object.keys(structured).filter(k => structured[k] != null && structured[k] !== '').length;
    if (filledCount >= 5) {
        score += 7;
        breakdown.structured_rich = 7;
    } else if (filledCount >= 2) {
        score += 4;
        breakdown.structured_some = 4;
    }

    // 9. Meta description
    if (scrape && scrape.success && scrape.meta_description) {
        score += 2;
        breakdown.has_meta = 2;
    }

    score = Math.min(100, score);
    const label = score >= 60 ? 'completo' : score >= 30 ? 'parziale' : 'incomplete';
    return { score, label, breakdown };
}

/**
 * Estrae aggregateRating dal JSON-LD (Hotel, Restaurant, LocalBusiness, ecc.)
 */
function getAggregateRating(scrape) {
    if (!scrape || !scrape.json_ld) return null;
    for (const typeKey of Object.keys(scrape.json_ld)) {
        const obj = scrape.json_ld[typeKey];
        if (obj && obj.aggregateRating) {
            const ar = obj.aggregateRating;
            return {
                ratingValue: ar.ratingValue != null ? Number(ar.ratingValue) : null,
                reviewCount: ar.reviewCount != null ? Number(ar.reviewCount) : (ar.ratingCount != null ? Number(ar.ratingCount) : null),
            };
        }
    }
    return null;
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

    // Email — preferenza email_referente specifico, altrimenti prima generica
    if (!currentProspect?.contact_email) {
        const referenti = Array.isArray(scrape.emails_referenti) ? scrape.emails_referenti : [];
        const preferred = referenti.length > 0 ? referenti[0].email : (scrape.emails?.[0] || null);
        if (preferred) out.contact_email = preferred;
    }
    // Phone — solo se mancante
    if (!currentProspect?.contact_phone && scrape.phones && scrape.phones.length > 0) {
        out.contact_phone = scrape.phones[0];
    }
    // Social links — merge
    if (scrape.socials && Object.keys(scrape.socials).length > 0) {
        out.social_links = { ...(currentProspect?.social_links || {}), ...scrape.socials };
        if (!currentProspect?.linkedin_url && scrape.socials.linkedin) {
            out.linkedin_url = scrape.socials.linkedin;
        }
    }

    out.last_enriched_at = new Date().toISOString();
    return out;
}

/**
 * Estrae i campi strutturati e i metadati dallo scrape per arricchire l'ai_enrichment_data del prospect.
 * NON salva il testo raw (DB lean) — quello vive solo in memoria durante la chain.
 */
export function extractEnrichmentDataFromScrape(scrape) {
    if (!scrape || !scrape.success) return {};
    const out = {};
    // Structured fields (dipendono dal sector schema runtime)
    if (scrape.structured_fields && Object.keys(scrape.structured_fields).length > 0) {
        out.structured_fields = scrape.structured_fields;
    }
    // Rating + reviews da JSON-LD aggregateRating
    const ar = getAggregateRating(scrape);
    if (ar?.ratingValue != null) out.google_rating = ar.ratingValue;
    if (ar?.reviewCount != null) out.google_reviews_count = ar.reviewCount;
    // Email referenti (lista persone con email specifica, utile per outreach)
    if (Array.isArray(scrape.emails_referenti) && scrape.emails_referenti.length > 0) {
        out.email_referenti = scrape.emails_referenti;
    }
    // Email aggiuntive disponibili (oltre alla contact_email principale)
    if (Array.isArray(scrape.emails) && scrape.emails.length > 1) {
        out.emails_secondary = scrape.emails.slice(1);
    }
    // Pages scraped meta (debug + transparency)
    if (Array.isArray(scrape.pages_scraped)) {
        out.scrape_pages = scrape.pages_scraped;
    }
    if (scrape.scrape_quality) {
        out.scrape_quality = scrape.scrape_quality;
    }
    // Fingerprint del framework (Next/Wix/Wordpress/SPA-empty/ecc.)
    if (scrape.fingerprint) {
        out.site_fingerprint = scrape.fingerprint;
    }
    // Dati JSON-LD strutturati: P.IVA, ragione sociale, titolare, anno fondazione, dipendenti
    if (scrape.vat_id)              out.vat_id              = scrape.vat_id;
    if (scrape.legal_name)          out.legal_name          = scrape.legal_name;
    if (scrape.founder)             out.founder             = scrape.founder;
    if (scrape.founding_date)       out.founding_date       = scrape.founding_date;
    if (scrape.number_of_employees) out.number_of_employees = scrape.number_of_employees;
    if (scrape.employee)            out.employee            = scrape.employee;
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

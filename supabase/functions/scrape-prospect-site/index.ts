// Edge function: scrape-prospect-site — v2
// Pipeline:
//  1. Fetch home (+ sub-pagine /contatti, /chi-siamo, /privacy, /team)
//  2. Fingerprint framework (Next.js, Nuxt, Wordpress, Wix, custom SPA, static)
//  3. Estrazione "shortcut" da JSON inline (__NEXT_DATA__, __NUXT__, __APOLLO_STATE__)
//  4. JSON-LD esteso (schema.org LocalBusiness/Organization/Person:
//     founder, legalName, taxID, vatID, employee, foundingDate, sameAs, address, contactPoint)
//  5. Regex fallback su HTML pulito (email, telefono, P.IVA, social)
//  6. Sitemap fallback se home povera → prime 5 pagine rilevanti
//  7. Output strutturato per AI enrichment + scrape_quality

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 GleeyeBot/2.0';
const MAX_HTML_SIZE = 800_000;        // 800KB max per pagina
const FETCH_TIMEOUT_MS = 9000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_PAGES = 5;                  // home + max 4 sub-pagine
const SUB_PATHS = ['/contatti', '/contact', '/contact-us', '/chi-siamo', '/about', '/about-us', '/team', '/staff', '/privacy', '/privacy-policy', '/note-legali', '/legal'];

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { url, sector_schema } = await req.json();
        if (!url || typeof url !== 'string') return jsonResponse({ error: 'url required' }, 400);

        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) return jsonResponse({ error: 'invalid url' }, 400);

        const result = await scrapeSite(normalizedUrl, sector_schema);
        return jsonResponse(result, 200);
    } catch (err: any) {
        console.error('[scrape-prospect-site] error', err);
        return jsonResponse({ error: String(err?.message || err), success: false }, 500);
    }
});

function jsonResponse(obj: any, status: number) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function normalizeUrl(url: string): string | null {
    let u = url.trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
        const parsed = new URL(u);
        if (!parsed.hostname) return null;
        return parsed.href;
    } catch (_) { return null; }
}

// ─── PIPELINE PRINCIPALE ──────────────────────────────────────────────────────

async function scrapeSite(url: string, sectorSchema: any) {
    const startedAt = Date.now();

    // 1. Fetch home
    const home = await fetchPage(url);
    if (!home.ok) {
        return {
            success: false,
            error: home.error,
            url,
            final_url: home.final_url,
            http_status: home.http_status,
            scraped_at: new Date().toISOString(),
            elapsed_ms: Date.now() - startedAt,
        };
    }

    // 2. Fingerprint framework
    const fingerprint = fingerprintFramework(home.html, home.final_url);

    // 3. Trova URL sub-pagine da provare
    const baseUrl = new URL(home.final_url);
    const subUrls: string[] = [];
    // 3a) Cerca anchor link interni a path "contatti/chi-siamo/team/privacy" nell'HTML
    const internalLinks = extractInternalLinks(home.html, baseUrl);
    for (const path of SUB_PATHS) {
        const match = internalLinks.find(l => l.pathname.toLowerCase().includes(path.replace('/', '')));
        if (match && !subUrls.includes(match.href)) subUrls.push(match.href);
        if (subUrls.length >= MAX_PAGES - 1) break;
    }
    // 3b) Se ancora poche, brute-force i path canonici
    if (subUrls.length < 3) {
        for (const path of SUB_PATHS) {
            const candidate = baseUrl.origin + path;
            if (!subUrls.includes(candidate)) subUrls.push(candidate);
            if (subUrls.length >= MAX_PAGES - 1) break;
        }
    }

    // 4. Fetch sub-pagine in parallelo (timeout aggressivo)
    const subResults = await Promise.allSettled(
        subUrls.slice(0, MAX_PAGES - 1).map(u => fetchPage(u))
    );
    const subPages = subResults
        .map(r => r.status === 'fulfilled' ? r.value : null)
        .filter((p): p is FetchedPage => !!p && p.ok);

    // 5. Aggrega HTML di home + sub per estrazioni globali
    const allHtml = [home.html, ...subPages.map(p => p.html)];
    const allUrls = [home.final_url, ...subPages.map(p => p.final_url)];

    // 6. Estrazione strutturata
    const jsonLd = extractAllJsonLd(allHtml);
    const inlineData = extractInlineFrameworkData(home.html, fingerprint.framework);
    const text = allHtml.map(h => extractCleanText(h)).join('\n\n').slice(0, MAX_TEXT_LENGTH * 2);

    const title = extractTitle(home.html);
    const metaDescription = extractMetaDescription(home.html);

    const emails = extractEmailsFromMany(allHtml);
    const emailsByPage = subPages.map(p => ({
        url: p.final_url,
        emails: extractEmails(p.html),
    })).filter(p => p.emails.length > 0);
    const emailsReferenti = emailsByPage
        .filter(p => /team|staff|chi-siamo|about/i.test(p.url))
        .flatMap(p => p.emails.map(e => ({ email: e, from_url: p.url })));

    const socials = extractSocialsFromAll(allHtml, jsonLd);
    const phones = extractPhonesFromMany(allHtml);

    // 7. Pattern italiani: P.IVA, codice fiscale azienda
    const vatId = extractVatId(allHtml) || pickFromJsonLd(jsonLd, ['vatID', 'taxID']);
    const legalName = pickFromJsonLd(jsonLd, ['legalName']);
    const founder = pickFromJsonLd(jsonLd, ['founder']);
    const foundingDate = pickFromJsonLd(jsonLd, ['foundingDate']);
    const employee = pickFromJsonLd(jsonLd, ['employee']);
    const numberOfEmployees = pickFromJsonLd(jsonLd, ['numberOfEmployees']);

    // 8. Structured fields settore-specifici (regex+keywords passati dal client)
    const structuredFields = sectorSchema
        ? extractStructuredFieldsFromSchema(text, sectorSchema)
        : {};

    // 9. Quality score
    const scrapeQuality = scoreScrapeQuality({
        text, emails, socials, title, metaDescription,
        pages_scraped: 1 + subPages.length,
        json_ld_count: jsonLd.length,
        fingerprint,
    });

    return {
        success: true,
        url,
        final_url: home.final_url,
        http_status: home.http_status,
        pages_scraped: 1 + subPages.length,
        pages_urls: allUrls,
        fingerprint,
        title,
        meta_description: metaDescription,
        text: text.slice(0, MAX_TEXT_LENGTH),
        text_length: text.length,
        truncated: text.length > MAX_TEXT_LENGTH,
        emails,
        emails_referenti: emailsReferenti,
        socials,
        phones,
        vat_id: vatId,
        legal_name: legalName,
        founder,
        founding_date: foundingDate,
        employee,
        number_of_employees: numberOfEmployees,
        json_ld: jsonLd,
        inline_data_keys: inlineData ? Object.keys(inlineData) : [],
        structured_fields: structuredFields,
        scrape_quality: scrapeQuality,
        scraped_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt,
    };
}

// ─── FETCH PAGINA ────────────────────────────────────────────────────────────

type FetchedPage = { ok: true; html: string; http_status: number; final_url: string }
                 | { ok: false; error: string; http_status: number; final_url: string };

async function fetchPage(url: string): Promise<FetchedPage> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
            },
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeoutId);
        const contentType = resp.headers.get('content-type') || '';
        const finalUrl = resp.url;
        if (!resp.ok) return { ok: false, error: 'HTTP ' + resp.status, http_status: resp.status, final_url: finalUrl };
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return { ok: false, error: 'Not HTML (' + contentType + ')', http_status: resp.status, final_url: finalUrl };
        }
        const reader = resp.body?.getReader();
        if (!reader) return { ok: false, error: 'No body', http_status: resp.status, final_url: finalUrl };
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < MAX_HTML_SIZE) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.byteLength;
        }
        reader.cancel();
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
            merged.set(c.subarray(0, Math.min(c.byteLength, total - offset)), offset);
            offset += c.byteLength;
        }
        const html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
        return { ok: true, html, http_status: resp.status, final_url: finalUrl };
    } catch (err: any) {
        clearTimeout(timeoutId);
        return { ok: false, error: String(err?.message || err), http_status: 0, final_url: url };
    }
}

// ─── FINGERPRINT FRAMEWORK ───────────────────────────────────────────────────

function fingerprintFramework(html: string, _url: string) {
    const h = html.slice(0, 50_000);  // top 50KB sufficienti
    const has = (re: RegExp) => re.test(h);

    let framework = 'unknown';
    let rendering = 'unknown';  // 'ssr' | 'csr' | 'hybrid'
    const signals: string[] = [];

    // Next.js
    if (has(/__NEXT_DATA__/)) { framework = 'nextjs'; rendering = 'ssr'; signals.push('__NEXT_DATA__'); }
    // Nuxt
    else if (has(/__NUXT__|window\.__NUXT/)) { framework = 'nuxt'; rendering = 'ssr'; signals.push('__NUXT__'); }
    // Gatsby
    else if (has(/window\.___gatsby|page-data\.json/)) { framework = 'gatsby'; rendering = 'ssg'; signals.push('___gatsby'); }
    // Wix
    else if (has(/static\.wixstatic\.com|wixsite\.com|X-Wix-/)) { framework = 'wix'; rendering = 'ssr-csr'; signals.push('wix'); }
    // Squarespace
    else if (has(/squarespace\.com|static1\.squarespace|sqs-block/i)) { framework = 'squarespace'; rendering = 'ssr'; signals.push('squarespace'); }
    // Webflow
    else if (has(/webflow\.com|w-webflow|data-wf-page/)) { framework = 'webflow'; rendering = 'ssr'; signals.push('webflow'); }
    // Shopify
    else if (has(/cdn\.shopify\.com|Shopify\.theme/)) { framework = 'shopify'; rendering = 'ssr'; signals.push('shopify'); }
    // Wordpress (Elementor, Divi, classico)
    else if (has(/wp-content|wp-includes|generator.+WordPress/i)) {
        framework = 'wordpress'; rendering = 'ssr';
        signals.push('wp');
        if (has(/elementor/i)) signals.push('elementor');
        if (has(/divi/i)) signals.push('divi');
    }
    // Joomla
    else if (has(/joomla|\/media\/system\/js/i)) { framework = 'joomla'; rendering = 'ssr'; signals.push('joomla'); }
    // Drupal
    else if (has(/drupal-settings-json|drupal\.org/i)) { framework = 'drupal'; rendering = 'ssr'; signals.push('drupal'); }
    // Framer
    else if (has(/framer\.com|framerusercontent/i)) { framework = 'framer'; rendering = 'ssr'; signals.push('framer'); }
    // React/Vue generic SPA (root vuoto)
    else if (has(/<div id="root"><\/div>|<div id="app"><\/div>/)) {
        framework = 'spa-empty'; rendering = 'csr';
        signals.push('empty-root');
    }

    // Heuristics CSR: HTML <body> molto corto + <script> grande
    const bodyMatch = h.match(/<body[^>]*>([\s\S]*?)(<\/body>|$)/i);
    const bodyLen = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, '').trim().length : 0;
    const scriptTotal = (h.match(/<script[\s\S]*?<\/script>/g) || []).join('').length;
    if (rendering === 'unknown') {
        if (bodyLen < 200 && scriptTotal > 50_000) { rendering = 'csr'; signals.push('thin-body-fat-js'); }
        else { rendering = 'ssr'; }
    }

    return { framework, rendering, signals, body_text_length: bodyLen, script_size: scriptTotal };
}

// ─── ESTRAZIONI DATI INLINE ──────────────────────────────────────────────────

function extractInlineFrameworkData(html: string, framework: string): any {
    if (framework === 'nextjs') {
        const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) { try { return JSON.parse(m[1]); } catch (_) { return null; } }
    }
    if (framework === 'nuxt') {
        const m = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?);?\s*<\/script>/);
        if (m) { try { return JSON.parse(m[1]); } catch (_) { /* eval-friendly form, skip */ } }
    }
    if (framework === 'gatsby') {
        const m = html.match(/window\.pageData\s*=\s*({[\s\S]*?});/);
        if (m) { try { return JSON.parse(m[1]); } catch (_) { return null; } }
    }
    return null;
}

function extractAllJsonLd(htmls: string[]): any[] {
    const out: any[] = [];
    for (const html of htmls) {
        const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let m;
        while ((m = re.exec(html)) !== null) {
            const raw = m[1].trim();
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) out.push(...parsed);
                else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) out.push(...parsed['@graph']);
                else out.push(parsed);
            } catch (_) { /* invalid JSON-LD, skip */ }
        }
    }
    return out;
}

function pickFromJsonLd(jsonLd: any[], paths: string[]): any {
    for (const obj of jsonLd) {
        for (const p of paths) {
            const v = obj?.[p];
            if (v != null && v !== '') {
                if (typeof v === 'object' && v.name) return v.name;
                if (Array.isArray(v) && v.length) {
                    const first = v[0];
                    return typeof first === 'object' ? (first.name || first) : first;
                }
                return v;
            }
        }
    }
    return null;
}

// ─── ESTRAZIONI HTML/TESTO ──────────────────────────────────────────────────

function extractInternalLinks(html: string, base: URL): URL[] {
    const out: URL[] = [];
    const re = /<a[^>]+href=["']([^"']+)["']/gi;
    let m;
    const seen = new Set<string>();
    while ((m = re.exec(html)) !== null) {
        try {
            const u = new URL(m[1], base);
            if (u.hostname !== base.hostname) continue;
            if (seen.has(u.href)) continue;
            seen.add(u.href);
            out.push(u);
        } catch (_) { /* ignore */ }
        if (out.length > 200) break;
    }
    return out;
}

function extractTitle(html: string): string {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? decodeHtmlEntities(m[1].trim()).slice(0, 200) : '';
}

function extractMetaDescription(html: string): string {
    const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
        || html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    return m ? decodeHtmlEntities(m[1].trim()).slice(0, 500) : '';
}

function extractCleanText(html: string): string {
    let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<head[\s\S]*?<\/head>/gi, ' ');
    cleaned = cleaned.replace(/<\/?(p|div|br|li|h[1-6]|tr|td|article|section|header|footer|main|aside|nav)[^>]*>/gi, '\n');
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');
    cleaned = decodeHtmlEntities(cleaned);
    cleaned = cleaned
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n+/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    return cleaned;
}

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&euro;/g, '€')
        .replace(/&agrave;/g, 'à').replace(/&egrave;/g, 'è').replace(/&eacute;/g, 'é')
        .replace(/&igrave;/g, 'ì').replace(/&ograve;/g, 'ò').replace(/&ugrave;/g, 'ù')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractEmails(html: string): string[] {
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const matches = html.match(re) || [];
    const blocklist = ['example.com', 'sentry.io', 'wixpress.com', 'wordpress.com', 'godaddy.com', 'cloudflare.com', 'gstatic.com', 'googleapis.com', 'noemail', 'no-reply', 'no_reply', 'donotreply', 'mailerlite', 'mailchimp', 'sentry-next.wixpress', 'u003e', '.png', '.jpg', '.svg', '.gif'];
    const filtered = matches.filter(e => {
        const low = e.toLowerCase();
        return !blocklist.some(b => low.includes(b));
    });
    return Array.from(new Set(filtered)).slice(0, 15);
}

function extractEmailsFromMany(htmls: string[]): string[] {
    const all = htmls.flatMap(h => extractEmails(h));
    return Array.from(new Set(all)).slice(0, 20);
}

function extractSocialsFromAll(htmls: string[], jsonLd: any[]) {
    const out: Record<string, string> = {};
    const find = (h: string, re: RegExp) => h.match(re)?.[0] || null;
    for (const h of htmls) {
        out.facebook  ||= find(h, /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._%-]+/i) || '';
        out.instagram ||= find(h, /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._%-]+/i) || '';
        out.linkedin  ||= find(h, /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._%-]+/i) || '';
        out.youtube   ||= find(h, /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|user\/|channel\/|@)[A-Za-z0-9._%-]+/i) || '';
        out.tiktok    ||= find(h, /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._%-]+/i) || '';
        out.twitter   ||= find(h, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9._%-]+/i) || '';
    }
    // JSON-LD sameAs (lista URL social ufficiali)
    for (const obj of jsonLd) {
        const same = obj?.sameAs;
        if (!same) continue;
        const arr = Array.isArray(same) ? same : [same];
        for (const u of arr) {
            const s = String(u);
            if (/facebook\.com/i.test(s))  out.facebook  ||= s;
            if (/instagram\.com/i.test(s)) out.instagram ||= s;
            if (/linkedin\.com/i.test(s))  out.linkedin  ||= s;
            if (/youtube\.com/i.test(s))   out.youtube   ||= s;
            if (/tiktok\.com/i.test(s))    out.tiktok    ||= s;
            if (/(twitter|x)\.com/i.test(s)) out.twitter ||= s;
        }
    }
    // pulisci vuoti
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(out)) if (v) clean[k] = v;
    return clean;
}

function extractPhones(html: string): string[] {
    const re = /(?:\+39[\s.-]*)?(?:0\d{1,3}|3\d{2})[\s.-]*\d{3,4}[\s.-]*\d{3,4}/g;
    const matches = html.match(re) || [];
    return Array.from(new Set(matches.map(p => p.replace(/[\s.-]+/g, ' ').trim()))).slice(0, 5);
}

function extractPhonesFromMany(htmls: string[]): string[] {
    const all = htmls.flatMap(h => extractPhones(h));
    return Array.from(new Set(all)).slice(0, 8);
}

function extractVatId(htmls: string[]): string | null {
    // P.IVA italiana: 11 cifre, spesso preceduto da "P.IVA", "P. IVA", "VAT", "C.F.", "Codice Fiscale"
    const re = /\b(?:P\.?\s*IVA|VAT|C\.F\.|Codice\s+Fiscale|Partita\s+IVA)\s*[:\-]?\s*(\d{11})\b/i;
    for (const h of htmls) {
        const m = h.match(re);
        if (m) return m[1];
    }
    // Anche solo 11 cifre nel footer (rischioso, basso priorità)
    return null;
}

function extractStructuredFieldsFromSchema(text: string, schema: any): Record<string, any> {
    const out: Record<string, any> = {};
    const fields = schema?.fields || [];
    const lower = text.toLowerCase();
    for (const f of fields) {
        if (!f.key) continue;
        // Regex patterns
        const patterns = f.regex_patterns || [];
        for (const p of patterns) {
            try {
                const re = new RegExp(p, 'i');
                const m = text.match(re);
                if (m) { out[f.key] = m[1] || m[0]; break; }
            } catch (_) { /* invalid regex */ }
        }
        // Keywords (presenza)
        if (!out[f.key] && f.regex_keywords && Array.isArray(f.regex_keywords)) {
            const found = f.regex_keywords.filter((kw: string) => kw && lower.includes(kw.toLowerCase()));
            if (found.length > 0) out[f.key] = found;
        }
    }
    return out;
}

function scoreScrapeQuality(d: {
    text: string;
    emails: string[];
    socials: Record<string, string>;
    title: string;
    metaDescription: string;
    pages_scraped: number;
    json_ld_count: number;
    fingerprint: { framework: string; rendering: string };
}) {
    let score = 0;
    const reasons: string[] = [];
    if (d.text.length > 4000) { score += 30; reasons.push('testo ricco'); }
    else if (d.text.length > 1000) { score += 18; reasons.push('testo medio'); }
    else if (d.text.length > 200) { score += 8; reasons.push('testo scarso'); }
    if (d.emails.length > 0) { score += 18; reasons.push(d.emails.length + ' email'); }
    if (Object.keys(d.socials).length > 0) { score += 12; reasons.push(Object.keys(d.socials).length + ' social'); }
    if (d.title && d.title.length > 5) { score += 8; reasons.push('title'); }
    if (d.metaDescription && d.metaDescription.length > 20) { score += 8; reasons.push('meta'); }
    if (d.json_ld_count > 0) { score += 10; reasons.push(d.json_ld_count + ' JSON-LD'); }
    if (d.pages_scraped > 1) { score += 7; reasons.push(d.pages_scraped + ' pagine'); }

    // Flag: sito JS-rendered che non siamo riusciti a leggere
    const isCsrEmpty = d.fingerprint.rendering === 'csr' && d.text.length < 500;
    const blocked_by_js = isCsrEmpty;
    if (isCsrEmpty) reasons.push('SPA CSR — contenuti caricati via JS, scraper non li vede');

    const label = score >= 70 ? 'ottimo' : score >= 40 ? 'medio' : score >= 15 ? 'scarso' : 'fallito';
    return { score, label, reasons, blocked_by_js, framework: d.fingerprint.framework, rendering: d.fingerprint.rendering };
}

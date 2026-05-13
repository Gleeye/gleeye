// Edge function: scrape-prospect-site
// Fetcha l'HTML del sito di un prospect, estrae:
// - testo body (pulito, max ~10K char)
// - email candidate (regex)
// - social link (Facebook, Instagram, LinkedIn, YouTube, TikTok)
// - telefoni candidate (regex italiani)
// Alimenta l'AI enrichment con materiale REALE invece di nome + URL.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 GleeyeBot/1.0';
const MAX_HTML_SIZE = 500_000;  // 500KB max
const FETCH_TIMEOUT_MS = 8000;
const MAX_TEXT_LENGTH = 10_000;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();
        if (!url || typeof url !== 'string') {
            return jsonResponse({ error: 'url required' }, 400);
        }

        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) {
            return jsonResponse({ error: 'invalid url' }, 400);
        }

        const result = await scrapeSite(normalizedUrl);
        return jsonResponse(result, 200);

    } catch (err) {
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
    // Aggiungi https:// se manca protocollo
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
        const parsed = new URL(u);
        if (!parsed.hostname) return null;
        return parsed.href;
    } catch (_) {
        return null;
    }
}

async function scrapeSite(url: string) {
    const startedAt = Date.now();

    // Fetch HTML con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html = '';
    let httpStatus = 0;
    let contentType = '';
    let finalUrl = url;
    let fetchError: string | null = null;

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
        httpStatus = resp.status;
        contentType = resp.headers.get('content-type') || '';
        finalUrl = resp.url;

        if (!resp.ok) {
            fetchError = 'HTTP ' + resp.status;
        } else if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            fetchError = 'Not HTML (content-type: ' + contentType + ')';
        } else {
            // Limit body size
            const reader = resp.body?.getReader();
            if (reader) {
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
                html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        fetchError = String(err?.message || err);
    }

    if (fetchError) {
        return {
            success: false,
            error: fetchError,
            url,
            final_url: finalUrl,
            http_status: httpStatus,
            scraped_at: new Date().toISOString(),
            elapsed_ms: Date.now() - startedAt,
        };
    }

    // Parse HTML
    const text = extractCleanText(html);
    const title = extractTitle(html);
    const metaDescription = extractMetaDescription(html);
    const emails = extractEmails(html);
    const socials = extractSocials(html);
    const phones = extractPhones(html);

    const scrapeQuality = scoreScrapeQuality({ text, emails, socials, title, metaDescription });

    return {
        success: true,
        url,
        final_url: finalUrl,
        http_status: httpStatus,
        title,
        meta_description: metaDescription,
        text: text.slice(0, MAX_TEXT_LENGTH),
        text_length: text.length,
        truncated: text.length > MAX_TEXT_LENGTH,
        emails,
        socials,
        phones,
        scrape_quality: scrapeQuality,
        scraped_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt,
    };
}

function extractTitle(html: string): string {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? decodeHtmlEntities(m[1].trim()).slice(0, 200) : '';
}

function extractMetaDescription(html: string): string {
    const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    return m ? decodeHtmlEntities(m[1].trim()).slice(0, 500) : '';
}

function extractCleanText(html: string): string {
    // Rimuovi script, style, noscript, head, comments
    let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<head[\s\S]*?<\/head>/gi, ' ');

    // Sostituisci br/p/div con newline
    cleaned = cleaned
        .replace(/<\/?(p|div|br|li|h[1-6]|tr|td|article|section|header|footer|main|aside|nav)[^>]*>/gi, '\n');

    // Strip remaining tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    cleaned = decodeHtmlEntities(cleaned);

    // Collapse whitespace
    cleaned = cleaned
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n+/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

    return cleaned;
}

function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&euro;/g, '€')
        .replace(/&agrave;/g, 'à')
        .replace(/&egrave;/g, 'è')
        .replace(/&eacute;/g, 'é')
        .replace(/&igrave;/g, 'ì')
        .replace(/&ograve;/g, 'ò')
        .replace(/&ugrave;/g, 'ù')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractEmails(html: string): string[] {
    // Email regex: filtra noemail/example/sentry/etc
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
    const matches = html.match(re) || [];
    const blocklist = ['example.com', 'sentry.io', 'wixpress.com', 'wordpress.com', 'godaddy.com', 'cloudflare.com', 'gstatic.com', 'googleapis.com', 'noemail', 'no-reply', 'no_reply', 'donotreply', 'mailerlite', 'mailchimp'];
    const filtered = matches.filter(e => {
        const low = e.toLowerCase();
        return !blocklist.some(b => low.includes(b)) && !low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.svg');
    });
    return Array.from(new Set(filtered)).slice(0, 10);
}

function extractSocials(html: string) {
    const out: Record<string, string> = {};
    const find = (re: RegExp) => {
        const m = html.match(re);
        return m ? m[0] : null;
    };
    const fb = find(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._%-]+/i);
    const ig = find(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._%-]+/i);
    const li = find(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._%-]+/i);
    const yt = find(/https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|user\/|channel\/|@)[A-Za-z0-9._%-]+/i);
    const tt = find(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._%-]+/i);
    if (fb) out.facebook = fb;
    if (ig) out.instagram = ig;
    if (li) out.linkedin = li;
    if (yt) out.youtube = yt;
    if (tt) out.tiktok = tt;
    return out;
}

function extractPhones(html: string): string[] {
    // Numeri italiani: +39 ... o 0... (almeno 8 cifre dopo prefisso)
    const re = /(?:\+39[\s.-]*)?(?:0\d{1,3}|3\d{2})[\s.-]*\d{3,4}[\s.-]*\d{3,4}/g;
    const matches = html.match(re) || [];
    return Array.from(new Set(matches.map(p => p.replace(/[\s.-]+/g, ' ').trim()))).slice(0, 5);
}

function scoreScrapeQuality(d: { text: string; emails: string[]; socials: Record<string, string>; title: string; metaDescription: string }): { score: number; label: string; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    if (d.text.length > 2000) { score += 35; reasons.push('testo ricco'); }
    else if (d.text.length > 500) { score += 20; reasons.push('testo medio'); }
    else if (d.text.length > 100) { score += 8; reasons.push('testo scarso'); }
    if (d.emails.length > 0) { score += 20; reasons.push(d.emails.length + ' email'); }
    if (Object.keys(d.socials).length > 0) { score += 15; reasons.push(Object.keys(d.socials).length + ' social'); }
    if (d.title && d.title.length > 5) { score += 15; reasons.push('title'); }
    if (d.metaDescription && d.metaDescription.length > 20) { score += 15; reasons.push('meta description'); }
    const label = score >= 70 ? 'ottimo' : score >= 40 ? 'medio' : score >= 15 ? 'scarso' : 'fallito';
    return { score, label, reasons };
}

// SAP Catalog View — SAP-3
// Vista catalogo dentro l'app: mostra i SAP come schede marketing
// (non la lista tecnica), con value prop, pricing, included, CTA ordine.

const STATUS_COLORS = {
    ready:      { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', label: 'Docs AI pronti' },
    generating: { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', label: 'Generando…'     },
    error:      { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', label: 'Errore AI'       },
    none:       { bg: 'rgba(0,0,0,0.04)',       text: 'var(--text-tertiary)', label: 'Da configurare' },
};

export function renderSapCatalog(container, services, serviceTypes) {
    if (!services || services.length === 0) {
        container.innerHTML = `<div style="padding:3rem; text-align:center; color:var(--text-tertiary);">Nessun SAP configurato.</div>`;
        return;
    }

    const configured = services.filter(s => s.value_proposition);
    const unconfigured = services.filter(s => !s.value_proposition);

    container.innerHTML = `
        <div style="padding:1.5rem 0;">
            ${configured.length > 0 ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.5rem; margin-bottom: ${unconfigured.length ? '2rem' : '0'};">
                    ${configured.map(s => _buildCatalogCard(s, serviceTypes)).join('')}
                </div>
            ` : ''}

            ${unconfigured.length > 0 ? `
                <div>
                    <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); letter-spacing:0.06em; margin-bottom:1rem; padding-left:0.25rem;">
                        Non ancora configurati — compila i "Dati per AI" per mostrarli qui
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:0.85rem;">
                        ${unconfigured.map(s => _buildMiniCard(s)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function _buildCatalogCard(s, serviceTypes) {
    const typeName = serviceTypes?.find(t => t.id === s.type_id)?.name || '';
    const status   = STATUS_COLORS[s.ai_doc_status || 'none'];
    const tiers    = (s.pricing_tiers || []).map(t => typeof t === 'string' ? t : t).slice(0, 3);
    const includes = (s.package_includes || []).slice(0, 5);

    const firstTierPrice = (() => {
        const first = tiers[0];
        if (!first) return null;
        if (typeof first === 'string') return first;
        return first.price ? `da ${first.price}€` : first.name;
    })();

    return `
        <div style="background:white; border:1px solid var(--glass-border); border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:var(--shadow-sm); transition:box-shadow 0.2s, transform 0.2s;"
             onmouseover="this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='var(--shadow-sm)'; this.style.transform='translateY(0)'">

            <!-- Card header gradient -->
            <div style="padding:1.5rem; background:var(--brand-gradient); color:white; position:relative;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;">
                    <div>
                        ${typeName ? `<div style="font-size:0.65rem; font-weight:700; text-transform:uppercase; opacity:0.75; margin-bottom:0.4rem;">${typeName}</div>` : ''}
                        <h3 style="margin:0; font-size:1.2rem; font-weight:800; font-family:var(--font-titles); line-height:1.2;">${s.name}</h3>
                    </div>
                    ${firstTierPrice ? `
                        <div style="flex-shrink:0; background:rgba(255,255,255,0.2); border-radius:10px; padding:0.4rem 0.75rem; font-size:0.85rem; font-weight:800; white-space:nowrap;">
                            ${firstTierPrice}
                        </div>
                    ` : ''}
                </div>
                ${s.value_proposition ? `
                    <p style="margin:0.85rem 0 0 0; font-size:0.85rem; opacity:0.9; line-height:1.5;">${s.value_proposition}</p>
                ` : ''}
            </div>

            <!-- Body -->
            <div style="padding:1.25rem 1.5rem; flex:1; display:flex; flex-direction:column; gap:1rem;">

                ${s.target_customer ? `
                    <div>
                        <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.35rem;">Per chi è</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${s.target_customer}</div>
                    </div>
                ` : ''}

                ${includes.length > 0 ? `
                    <div>
                        <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Cosa include</div>
                        <div style="display:flex; flex-direction:column; gap:0.3rem;">
                            ${includes.map(i => {
                                const label = typeof i === 'string' ? i : (i.label || '');
                                return `<div style="display:flex; align-items:flex-start; gap:0.5rem; font-size:0.82rem; color:var(--text-secondary);">
                                    <span class="material-icons-round" style="font-size:0.85rem; color:#10b981; flex-shrink:0; margin-top:1px;">check_circle</span>
                                    ${label}
                                </div>`;
                            }).join('')}
                            ${(s.package_includes || []).length > 5 ? `<div style="font-size:0.75rem; color:var(--text-tertiary); padding-left:1.35rem;">+${(s.package_includes || []).length - 5} altri</div>` : ''}
                        </div>
                    </div>
                ` : ''}

                ${tiers.length > 1 ? `
                    <div>
                        <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Pricing</div>
                        <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                            ${tiers.map((t, i) => {
                                const name  = typeof t === 'string' ? t : (t.name || '');
                                const price = typeof t === 'string' ? '' : (t.price ? `${t.price}€` : '');
                                return `<div style="padding:0.35rem 0.75rem; border-radius:8px; background:var(--bg-secondary); border:1px solid var(--glass-border); font-size:0.78rem; font-weight:${i===0?'700':'600'}; color:var(--text-primary);">
                                    ${name}${price ? ' · ' + price : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="display:flex; gap:1rem; margin-top:auto;">
                    ${s.delivery_time_days ? `
                        <div style="display:flex; align-items:center; gap:0.3rem; font-size:0.78rem; color:var(--text-tertiary);">
                            <span class="material-icons-round" style="font-size:0.9rem;">schedule</span>
                            ${s.delivery_time_days} giorni
                        </div>
                    ` : ''}
                    ${s.team_required ? `
                        <div style="display:flex; align-items:center; gap:0.3rem; font-size:0.78rem; color:var(--text-tertiary);">
                            <span class="material-icons-round" style="font-size:0.9rem;">group</span>
                            ${s.team_required}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Footer -->
            <div style="padding:1rem 1.5rem; border-top:1px solid var(--glass-border); display:flex; align-items:center; justify-content:space-between; background:var(--bg-secondary);">
                <span style="font-size:0.7rem; padding:3px 9px; border-radius:8px; background:${status.bg}; color:${status.text}; font-weight:700;">
                    ${status.label}
                </span>
                <div style="display:flex; gap:0.5rem;">
                    <button onclick="window.location.hash='#sap-service-detail/${s.id}'" style="padding:0.45rem 0.9rem; border-radius:9px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:600; font-size:0.8rem; cursor:pointer;">
                        Dettaglio
                    </button>
                    <button onclick="window.openOrderFromSap('${s.id}')" style="padding:0.45rem 0.9rem; border-radius:9px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 3px 8px rgba(99,102,241,0.25);">
                        Crea ordine
                    </button>
                </div>
            </div>
        </div>
    `;
}

function _buildMiniCard(s) {
    return `
        <div onclick="window.location.hash='#sap-service-detail/${s.id}'" style="padding:1rem 1.25rem; background:white; border:1px dashed var(--glass-border); border-radius:14px; cursor:pointer; display:flex; align-items:center; gap:0.75rem; transition:border-color 0.2s;"
             onmouseover="this.style.borderColor='var(--brand-blue)'"
             onmouseout="this.style.borderColor='var(--glass-border)'">
            <div style="width:34px; height:34px; border-radius:8px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-icons-round" style="font-size:1.1rem; color:var(--text-tertiary);">diamond</span>
            </div>
            <div>
                <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary);">${s.name}</div>
                <div style="font-size:0.72rem; color:var(--text-tertiary); margin-top:0.1rem;">Clicca per configurare</div>
            </div>
        </div>
    `;
}

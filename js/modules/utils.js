/* --- UTILITY --- */
export const formatAmount = (amount) => {
    // Force manual formatting to ensure thousands separator even for 4 digits (e.g. 7.000,00)
    // which some browser implementations of Intl might simplify.
    const num = Number(amount) || 0;
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
};

// --- FISCAL CALCULATOR ---
export const FiscalCalculator = {
    calculate: (taxable, type, hasRivalsa, hasBollo, hasIvaAttiva) => {
        taxable = parseFloat(taxable) || 0;
        let rivalsInps = 0;
        let vat = 0;
        let ritenuta = 0;
        let stampDuty = 0;

        // 1. Rivalsa INPS (4%) - Applied to taxable base if requested
        if (hasRivalsa) {
            rivalsInps = taxable * 0.04;
        }

        const baseForTax = taxable + rivalsInps;

        // 2. Evolution Logic for Collaboration Types
        if (type === "Ritenuta d'acconto") {
            // Prestazione Occasionale: 20% withholding on base, no VAT
            ritenuta = baseForTax * 0.20;
            vat = 0;
            if (hasBollo && baseForTax > 77.47) stampDuty = 2.00;
        } else if (type === "Fattura") {
            // Can be "Ordinario" or "Forfettario" based on checkboxes
            // User requested "sostituisci e implementa" for Collaboration Type
            // Let's assume Fattura is the standard and we use Iva Attiva to decide
            if (hasIvaAttiva) {
                vat = baseForTax * 0.22;
                ritenuta = 0;
                stampDuty = 0;
            } else {
                // Forfettario-like: No VAT, yes Bollo
                vat = 0;
                ritenuta = 0;
                if (hasBollo && baseForTax > 77.47) stampDuty = 2.00;
            }
        } else if (type === "Nota di Credito") {
            // Simplified: Negative values
            return { taxable: -taxable, vat: 0, rivalsInps: 0, ritenuta: 0, stampDuty: 0, total: -taxable, netToPay: -taxable };
        }

        const total = baseForTax + vat + stampDuty;
        const netToPay = total - ritenuta;
        return {
            taxable,
            rivalsInps: parseFloat(rivalsInps.toFixed(2)),
            vat: parseFloat(vat.toFixed(2)),
            ritenuta: parseFloat(ritenuta.toFixed(2)),
            stampDuty: parseFloat(stampDuty.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            netToPay: parseFloat(netToPay.toFixed(2))
        };
    }
};



// --- MODAL UTILS ---
export function renderModal(modalId, content) {
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-content animate-scale-in">
            ${content}
        </div>
    `;

    // Attach close handlers locally
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalId));
    });

    // Force reflow
    void modal.offsetWidth;
    modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) modal.remove();
        }, 300); // Match CSS transition
    }
}

export const showGlobalAlert = (message, type = 'success') => {
    const alert = document.createElement('div');
    alert.className = `global-alert ${type} animate-fade-in`;
    alert.innerText = message;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg);
        color: var(--text-primary);
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: var(--card-shadow);
        border: 1px solid var(--glass-border);
        z-index: 10000;
        font-weight: 500;
    `;
    document.body.appendChild(alert);
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 500);
    }, 3000);
};

export const showConfirm = (message, title = 'Conferma') => {
    return new Promise((resolve) => {
        const modalId = `confirm-modal-${Date.now()}`;
        const content = `
            <div style="padding: 0.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-family: var(--font-titles);">${title}</h3>
                <p style="margin: 0 0 2rem 0; color: var(--text-secondary); line-height: 1.5;">${message}</p>
                <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                    <button class="primary-btn secondary small" id="confirm-cancel-${modalId}" style="min-width: 100px;">Annulla</button>
                    <button class="primary-btn small" id="confirm-ok-${modalId}" style="min-width: 100px; background: linear-gradient(135deg, #8b5cf6, #6366f1);">Conferma</button>
                </div>
            </div>
        `;

        renderModal(modalId, content);

        const cleanup = (result) => {
            closeModal(modalId);
            resolve(result);
        };

        document.getElementById(`confirm-cancel-${modalId}`).onclick = () => cleanup(false);
        document.getElementById(`confirm-ok-${modalId}`).onclick = () => cleanup(true);
    });
};

window.showGlobalAlert = showGlobalAlert;
window.showConfirm = showConfirm;

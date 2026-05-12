// Order action UI handlers (preventivo, docs modal, account activities, cloud resources).
// Extracted from orders.js. Side effects on import:
//   - window.generateQuote(orderId, btnElement)
//   - window.openOrderDocsModal(spaceId)
//   - window.openAccountActivitiesModal(orderId, spaceId)
//   - window.openOrderCloudResourcesModal(orderId)

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { updateOrder, fetchOrders, fetchPayments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, fetchOrderAccounts, addOrderContact, removeOrderContact, fetchOrderContacts, upsertPayment, deletePayment, updateOrderCloudLinks } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

import { CloudLinksManager } from '../components/CloudLinksManager.js?v=8000';

// Trigger Preventivo Webhook
window.generateQuote = async (orderId, btnElement) => {
    const confirmed = await window.showConfirm('Vuoi avviare la generazione automatica del preventivo?', 'Genera Preventivo');
    if (!confirmed) return;

    const webhookUrl = 'https://sacred-roughy-renewing.ngrok-free.app/webhook/3bf76037-4c02-4c24-a2e9-bd5790f57940';
    const originalContent = btnElement.innerHTML;

    try {
        btnElement.innerHTML = '<span class="material-icons-round spin">sync</span> Generazione...';
        btnElement.disabled = true;
        btnElement.style.opacity = '0.7';

        // 1. Fetch Full Data
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                clients (*),
                order_collaborators (
                    role_in_order,
                    collaborators (*)
                )
            `)
            .eq('id', orderId)
            .single();

        if (orderError) throw orderError;

        // 1b. Fetch Linked Services
        const { data: servicesData } = await supabase
            .from('collaborator_services')
            .select(`
                *,
                services (name)
            `)
            .eq('order_id', orderId);

        const formattedServices = (servicesData || []).map(s =>
            s.services?.name || s.legacy_service_name || s.name || 'Servizio'
        );

        // 2. Prepare Data
        const client = orderData.clients || {};
        const clientAddress = [client.address, client.cap, client.city, client.province ? `(${client.province})` : '']
            .filter(Boolean).join(' '); // Simple join

        const accountRel = orderData.order_collaborators?.find(oc => oc.role_in_order === 'Account');
        const account = accountRel?.collaborators || {};

        // Find existing Quote URL in cloud_links
        let quoteUrl = null;
        if (orderData.cloud_links && Array.isArray(orderData.cloud_links)) {
            const quoteLink = orderData.cloud_links.find(l =>
                (l.label && l.label.toLowerCase().includes('preventivo')) ||
                (l.type === 'quote')
            );
            if (quoteLink) quoteUrl = quoteLink.url;
        }

        const payload = {
            order_id: orderData.id,
            order_number: orderData.order_number,
            order_date: orderData.created_at,
            title: orderData.title || '', // Added
            client_code: client.client_code || '',
            client_business_name: client.business_name || '',
            client_address: clientAddress,
            client_vat_tax_code: client.vat_number || client.fiscal_code || '',
            account_full_name: account.full_name || '',
            account_email: account.email || '',
            account_phone: account.phone || '',
            price_final: orderData.price_final,
            payment_mode: orderData.payment_mode,
            payment_mode_label: formatPaymentMode(orderData.payment_mode),
            deposit_percentage: orderData.deposit_percentage,
            installment_types: orderData.installment_type,
            installment_count: orderData.installments_count,
            current_quote_url: quoteUrl,
            services: formattedServices // Added
        };

        // 3. Send Webhook & Await Result
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            const docUrl = result.url || result.link || (typeof result === 'string' ? result : null);

            if (docUrl) {
                // Update Cloud Links in DB
                const currentLinks = orderData.cloud_links || [];
                // Remove old auto-generated quotes to keep it clean? Or keep history. Let's keep history but mark new one.
                const newLink = {
                    label: `Preventivo ${new Date().toLocaleDateString('it-IT')}`,
                    url: docUrl,
                    type: 'quote',
                    generated_at: new Date().toISOString()
                };

                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        cloud_links: [...currentLinks, newLink]
                    })
                    .eq('id', orderId);

                if (updateError) console.error('Failed to save quote link:', updateError);

                showGlobalAlert('Preventivo generato con successo!', 'success');

                // Update Button permanently for this session
                btnElement.innerHTML = `
                    <span class="material-icons-round">open_in_new</span>
                    Apri Preventivo
                `;
                btnElement.onclick = () => window.open(docUrl, '_blank');
                btnElement.classList.remove('secondary');
                btnElement.disabled = false;
                btnElement.style.opacity = '1';
                btnElement.style.background = 'var(--success-color)';
                btnElement.style.color = 'white';

                return; // Skip finally reset
            } else {
                showGlobalAlert('Preventivo generato ma nessun link ricevuto.', 'warning');
            }
        } else {
            showGlobalAlert('Errore nell\'invio della richiesta.', 'error');
        }
    } catch (error) {
        console.error('Error triggering quote webhook:', error);
        showGlobalAlert('Errore durante la generazione: ' + error.message, 'error');
    } finally {
        // Reset only if we didn't return early (success case)
        if (btnElement.innerHTML.includes('Generazione')) {
            setTimeout(() => {
                btnElement.innerHTML = originalContent;
                btnElement.disabled = false;
                btnElement.style.opacity = '1';
            }, 2000);
        }
    }
};

// Order Documentation Modal
window.openOrderDocsModal = async (spaceId) => {
    if (!spaceId || spaceId === 'undefined') {
        alert('Spazio PM non trovato. Assicurati che l\'ordine sia collegato a un progetto attivo.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px; width: 95vw; height: 92vh; padding: 0; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);">
                        <span class="material-icons-round" style="font-size: 24px;">edit_note</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">Documentazione Commessa</h2>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 500;">Note, file ed editor collaborativo</div>
                    </div>
                </div>
                <button class="close-modal material-icons-round" onclick="this.closest('.modal').remove()" style="background: var(--surface-1); border:none; cursor:pointer; color:var(--text-tertiary); display:flex; align-items:center; padding: 10px; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--surface-2)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='var(--surface-1)'; this.style.color='var(--text-tertiary)'">
                    close
                </button>
            </div>
            <div id="modal-docs-container" style="flex: 1; position: relative; overflow: hidden; background: white;">
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary);">
                    <span class="loader"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');

    // Background click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    try {
        const docsContainer = modal.querySelector('#modal-docs-container');
        const { renderDocsView } = await import('../docs/DocsView.js?v=8000');
        await renderDocsView(docsContainer, spaceId);
    } catch (err) {
        console.error("Error loading Docs Modal:", err);
        modal.querySelector('#modal-docs-container').innerHTML = `<div style="padding: 2rem; color: #ef4444;">Errore nel caricamento del modulo documentazione: ${err.message}</div>`;
    }
};

// Account Activities Modal
window.openAccountActivitiesModal = async (orderId, spaceId) => {
    if (!spaceId || spaceId === 'undefined') {
        alert('Spazio PM non trovato. Assicurati che l\'ordine sia collegato a un progetto attivo.');
        return;
    }

    const { openAccountActivitiesModal } = await import('/js/features/pm/components/AccountActivitiesModal.js?v=8000');
    await openAccountActivitiesModal(orderId, spaceId);
};

// Cloud Resources Modal
window.openOrderCloudResourcesModal = async (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round">cloud_queue</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: var(--text-primary);">Risorse Cloud</h2>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">Link a Drive, Dropbox e altro</div>
                    </div>
                </div>
                <button class="close-modal material-icons-round" onclick="this.closest('.modal').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-tertiary);">close</button>
            </div>
            <div id="cloud-manager-container" style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');

    const container = modal.querySelector('#cloud-manager-container');
    new CloudLinksManager(container, order.cloud_links || [], async (updatedLinks) => {
        const { error } = await supabase.from('orders').update({ cloud_links: updatedLinks }).eq('id', orderId);
        if (error) {
            showGlobalAlert('Errore nel salvataggio dei link', 'error');
        } else {
            order.cloud_links = updatedLinks;
            // No full reload needed, state is updated
        }
    });

    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

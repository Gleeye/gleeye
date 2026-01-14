import { supabase } from '../modules/config.js?v=119';

export async function initSuppliers() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="fade-in">
            <div class="page-header">
                <div>
                    <h1>Fornitori</h1>
                    <p class="text-secondary">Gestione anagrafica fornitori</p>
                </div>
                <button id="add-supplier-btn" class="btn btn-primary">
                    <span class="material-icons-round">add</span>
                    Nuovo Fornitore
                </button>
            </div>

            <!-- Search & Filter Bar -->
            <div class="card mb-4">
                <div class="flex items-center gap-3 p-3">
                    <div class="flex-1 relative">
                        <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg">search</span>
                        <input 
                            type="text" 
                            id="supplier-search" 
                            class="form-control pl-10" 
                            placeholder="Cerca per nome, sito web o note..."
                        >
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="data-table" id="suppliers-table">
                        <thead>
                            <tr>
                                <th style="width: 30%">Nome</th>
                                <th style="width: 25%">Sito Web</th>
                                <th style="width: 30%">Note</th>
                                <th style="width: 15%" class="text-center">Azioni</th>
                            </tr>
                        </thead>
                        <tbody id="suppliers-table-body">
                            <tr>
                                <td colspan="4" class="text-center p-4">Caricamento in corso...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modal Fornitore (Add/Edit) -->
        <div id="supplier-modal" class="modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 id="supplier-modal-title">Nuovo Fornitore</h3>
                    <button class="close-modal"><span class="material-icons-round">close</span></button>
                </div>
                <div class="modal-body">
                    <form id="supplier-form">
                        <input type="hidden" id="supplier-id">
                        <div class="form-group">
                            <label for="supplier-name" class="form-label">Nome <span class="text-danger">*</span></label>
                            <input type="text" id="supplier-name" required class="form-control" placeholder="Es. Adobe, Google...">
                        </div>
                        <div class="form-group">
                            <label for="supplier-website" class="form-label">Sito Web</label>
                            <div class="relative">
                                <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">link</span>
                                <input type="url" id="supplier-website" class="form-control pl-10" placeholder="https://esempio.com">
                            </div>
                            <p class="text-xs text-secondary mt-1">Inserisci l'URL completo (incluso https://)</p>
                        </div>
                        <div class="form-group">
                            <label for="supplier-notes" class="form-label">Note</label>
                            <textarea id="supplier-notes" class="form-control" rows="3" placeholder="Informazioni aggiuntive sul fornitore..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer flex justify-end gap-3">
                    <button class="btn btn-secondary close-modal">Annulla</button>
                    <button id="save-supplier-btn" class="btn btn-primary">
                        <span class="material-icons-round text-sm">save</span>
                        Salva
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal Dettaglio Fornitore (Read Only + Invoices) -->
        <div id="supplier-detail-modal" class="modal">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>Dettaglio Fornitore</h3>
                    <button class="close-detail-modal"><span class="material-icons-round">close</span></button>
                </div>
                <div class="modal-body">
                    <!-- Supplier Info Section -->
                    <div class="detail-section mb-6">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h2 id="detail-name" class="text-2xl font-semibold mb-2">Nome Fornitore</h2>
                                <a id="detail-website" href="#" target="_blank" class="text-primary hover:underline flex items-center gap-2">
                                    <span class="material-icons-round text-base">link</span>
                                    <span class="text-sm">website.com</span>
                                </a>
                            </div>
                            <span id="detail-badge" class="badge badge-success">Attivo</span>
                        </div>
                        
                        <!-- Notes -->
                        <div class="p-4 bg-base-200 rounded-xl">
                            <p class="text-xs text-secondary uppercase tracking-wide font-medium mb-2">Note</p>
                            <p id="detail-notes" class="text-sm text-base-content/80">Nessuna nota.</p>
                        </div>
                    </div>

                    <div class="divider my-6"></div>

                    <!-- Invoice Summary Cards -->
                    <div id="invoice-summary-section" class="mb-6">
                        <h4 class="font-semibold mb-4 flex items-center gap-2 text-lg">
                            <span class="material-icons-round">assessment</span>
                            Riepilogo Fatture
                        </h4>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="p-4 bg-primary/10 rounded-xl border border-primary/20">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="material-icons-round text-primary text-sm">receipt_long</span>
                                    <p class="text-xs text-secondary uppercase tracking-wide">Totale Fatture</p>
                                </div>
                                <p id="summary-count" class="text-2xl font-bold text-primary">0</p>
                            </div>
                            <div class="p-4 bg-success/10 rounded-xl border border-success/20">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="material-icons-round text-success text-sm">euro</span>
                                    <p class="text-xs text-secondary uppercase tracking-wide">Importo Totale</p>
                                </div>
                                <p id="summary-total" class="text-2xl font-bold text-success">€ 0,00</p>
                            </div>
                            <div class="p-4 bg-info/10 rounded-xl border border-info/20">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="material-icons-round text-info text-sm">event</span>
                                    <p class="text-xs text-secondary uppercase tracking-wide">Ultima Fattura</p>
                                </div>
                                <p id="summary-last" class="text-base font-semibold text-info">-</p>
                            </div>
                        </div>
                    </div>

                    <div class="divider my-6"></div>

                    <!-- Invoices List -->
                    <div class="invoices-section">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="font-semibold flex items-center gap-2 text-lg">
                                <span class="material-icons-round">receipt_long</span>
                                Fatture Collegate
                            </h4>
                        </div>
                        <div class="table-container max-h-80 overflow-y-auto border rounded-xl">
                            <table class="data-table w-full text-sm">
                                <thead class="sticky top-0 bg-base-100 z-10 shadow-sm">
                                    <tr>
                                        <th class="text-left p-3">Data</th>
                                        <th class="text-left p-3">Numero</th>
                                        <th class="text-left p-3">Categoria</th>
                                        <th class="text-right p-3">Importo</th>
                                        <th class="text-center p-3">Doc</th>
                                    </tr>
                                </thead>
                                <tbody id="detail-invoices-body">
                                    <tr><td colspan="5" class="text-center p-4">Caricamento...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer flex justify-end gap-3">
                    <button class="btn btn-secondary close-detail-modal">Chiudi</button>
                    <button id="detail-edit-btn" class="btn btn-primary">
                        <span class="material-icons-round text-sm">edit</span>
                        Modifica
                    </button>
                </div>
            </div>
        </div>
    `;

    // Event Listeners
    document.getElementById('add-supplier-btn').addEventListener('click', () => openSupplierModal());
    document.getElementById('save-supplier-btn').addEventListener('click', saveSupplier);
    document.querySelectorAll('.close-modal').forEach(btn =>
        btn.addEventListener('click', () => document.getElementById('supplier-modal').classList.remove('active'))
    );
    document.querySelectorAll('.close-detail-modal').forEach(btn =>
        btn.addEventListener('click', () => document.getElementById('supplier-detail-modal').classList.remove('active'))
    );

    // Initial Load
    await loadSuppliers(false); // Load active by default

    // Insert filter button properly
    // Check if we already have the actions container to avoid duplicates if re-run
    const addBtn = document.getElementById('add-supplier-btn');
    if (!addBtn) return;

    // If container already exists (parent is header-actions), don't recreate
    if (addBtn.parentNode.className === 'header-actions') {
        return; // Already setup
    }

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'header-actions';
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '16px'; // increased gap
    actionsContainer.style.alignItems = 'center';

    // Move addBtn into container
    addBtn.parentNode.insertBefore(actionsContainer, addBtn);
    actionsContainer.appendChild(addBtn);

    const filterBtn = document.createElement('button');
    filterBtn.id = 'toggle-archive-btn';
    filterBtn.className = 'btn btn-outline';
    filterBtn.innerHTML = '<span class="material-icons-round">history</span> Archivio';
    filterBtn.style.display = 'flex';
    filterBtn.style.alignItems = 'center';
    filterBtn.style.gap = '8px';

    actionsContainer.insertBefore(filterBtn, addBtn);

    let showArchived = false;
    filterBtn.addEventListener('click', () => {
        showArchived = !showArchived;
        filterBtn.classList.toggle('active', showArchived);
        filterBtn.innerHTML = showArchived ?
            '<span class="material-icons-round">visibility_off</span> Nascondi' :
            '<span class="material-icons-round">history</span> Archivio';
        loadSuppliers(showArchived);
    });
}

async function loadSuppliers(showArchived = false) {
    const tbody = document.getElementById('suppliers-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><span class="loader"></span></td></tr>';

    let data = [];
    let error = null;

    try {
        let query = supabase
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true });

        if (showArchived) {
            query = query.is('archived', true);
        } else {
            query = query.eq('archived', false);
        }

        const res = await query;
        data = res.data;
        error = res.error;

        // Check for specific column missing error
        if (error && (error.message.includes('column "archived" does not exist') || error.code === '42703')) {
            console.warn("Archived column missing, falling back to show all.");
            const fallbackRes = await supabase.from('suppliers').select('*').order('name');
            data = fallbackRes.data;
            error = fallbackRes.error;
            // Clear the original error effectively
            if (!error) {
                // Determine layout or show toast?
            }
        }

    } catch (e) {
        console.error("Unexpected error loading suppliers:", e);
        error = e;
    }

    if (error) {
        console.error('Error loading suppliers:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Errore caricamento: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-8">${showArchived ? 'Nessun forn itore archiviato' : 'Nessun fornitore attivo'}</td></tr>`;
        return;
    }

    // Store globally for search
    window.suppliersData = data;

    renderSuppliersTable(data, showArchived);
}

function renderSuppliersTable(data, showArchived) {
    const tbody = document.getElementById('suppliers-table-body');

    tbody.innerHTML = data.map(s => `
        <tr class="supplier-row hover:bg-base-200 cursor-pointer transition-colors ${s.archived ? 'opacity-60' : ''}" data-id="${s.id}">
            <td class="font-medium">
                <div class="flex items-center gap-2">
                    ${s.archived ? '<span class="material-icons-round text-warning text-sm">inventory_2</span>' : ''}
                    <span>${s.name}</span>
                </div>
            </td>
            <td>
                ${s.website ?
            `<a href="${s.website}" target="_blank" class="text-primary hover:underline flex items-center gap-1 inline-flex" onclick="event.stopPropagation()">
                        <span class="material-icons-round text-xs">link</span>
                        <span class="text-sm truncate max-w-[200px]">${s.website}</span>
                    </a>` :
            '<span class="text-secondary/40 text-sm">—</span>'
        }
            </td>
            <td class="text-secondary text-sm">
                <span class="truncate block" title="${s.notes || ''}">${s.notes || '<span class="text-secondary/40">—</span>'}</span>
            </td>
            <td onclick="event.stopPropagation()">
                <div class="flex items-center justify-center gap-2">
                    <button class="icon-btn view-supplier-btn" data-id="${s.id}" title="Dettagli & Fatture">
                        <span class="material-icons-round">visibility</span>
                    </button>
                    <button class="icon-btn edit-supplier-btn" data-id="${s.id}" title="Modifica">
                        <span class="material-icons-round">edit</span>
                    </button>
                    <button class="icon-btn ${s.archived ? 'text-success' : 'text-warning'} archive-supplier-btn" data-id="${s.id}" 
                        title="${s.archived ? 'Ripristina' : 'Archivia'}" 
                        data-action="${s.archived ? 'restore' : 'archive'}">
                        <span class="material-icons-round">${s.archived ? 'restore_from_trash' : 'archive'}</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Attach listeners for row click
    document.querySelectorAll('.supplier-row').forEach(row => {
        row.addEventListener('click', () => {
            const supplier = data.find(s => s.id === row.dataset.id);
            openSupplierDetail(supplier);
        });
    });

    // Attach listeners for action buttons
    document.querySelectorAll('.view-supplier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const supplier = data.find(s => s.id === btn.dataset.id);
            openSupplierDetail(supplier);
        });
    });

    document.querySelectorAll('.edit-supplier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const supplier = data.find(s => s.id === btn.dataset.id);
            openSupplierModal(supplier);
        });
    });

    document.querySelectorAll('.archive-supplier-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (await window.showConfirm(action === 'archive' ? 'Archiviare questo fornitore?' : 'Ripristinare questo fornitore?', { type: 'warning' })) {
                await toggleArchive(id, action === 'archive');
                loadSuppliers(showArchived);
            }
        });
    });

    // Setup search functionality
    const searchInput = document.getElementById('supplier-search');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.dataset.listenerAttached = 'true';
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (!window.suppliersData) return;

            const filtered = window.suppliersData.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.website && s.website.toLowerCase().includes(query)) ||
                (s.notes && s.notes.toLowerCase().includes(query))
            );

            renderSuppliersTable(filtered, showArchived);
        });
    }
}


async function openSupplierDetail(supplier) {
    const modal = document.getElementById('supplier-detail-modal');

    // Fill Info
    document.getElementById('detail-name').textContent = supplier.name;
    const webEl = document.getElementById('detail-website');
    if (supplier.website) {
        webEl.href = supplier.website;
        webEl.classList.remove('hidden');
        webEl.querySelector('span:last-child').textContent = supplier.website;
    } else {
        webEl.classList.add('hidden');
    }

    document.getElementById('detail-notes').textContent = supplier.notes || "Nessuna nota.";
    const badge = document.getElementById('detail-badge');
    badge.textContent = supplier.archived ? 'Archiviato' : 'Attivo';
    badge.className = `badge ${supplier.archived ? 'badge-warning' : 'badge-success'}`;

    // Setup Edit Button in Detail
    const editBtn = document.getElementById('detail-edit-btn');
    editBtn.onclick = () => {
        modal.classList.remove('active');
        openSupplierModal(supplier);
    };

    // Show Modal
    modal.classList.add('active');

    // Fetch Invoices
    const tbody = document.getElementById('detail-invoices-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><span class="loader"></span></td></tr>';

    const { data: invoices, error } = await supabase
        .from('passive_invoices')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('issue_date', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center p-4">Impossibile caricare fatture: ${error.message}</td></tr>`;
        // Hide summary section
        document.getElementById('invoice-summary-section').style.display = 'none';
        return;
    }

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary p-8">
            <div class="flex flex-col items-center gap-2">
                <span class="material-icons-round text-4xl opacity-30">receipt_long</span>
                <p>Nessuna fattura collegata.</p>
            </div>
        </td></tr>`;
        // Hide summary section
        document.getElementById('invoice-summary-section').style.display = 'none';
        return;
    }

    // Show and populate summary section
    document.getElementById('invoice-summary-section').style.display = 'block';
    const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_included) || 0), 0);
    const lastInvoice = invoices[0]; // Already sorted by date DESC

    document.getElementById('summary-count').textContent = invoices.length;
    document.getElementById('summary-total').textContent = `€ ${totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('summary-last').textContent = lastInvoice.issue_date ?
        new Date(lastInvoice.issue_date).toLocaleDateString('it-IT') : '-';

    // Render invoices table
    tbody.innerHTML = invoices.map(inv => `
        <tr class="hover:bg-base-200/50 transition-colors">
            <td class="p-3">${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('it-IT') : '-'}</td>
            <td class="p-3 font-mono text-xs">${inv.invoice_number || '-'}</td>
            <td class="p-3 truncate max-w-[200px]" title="${inv.category || inv.notes || ''}">${inv.category || '-'}</td>
            <td class="p-3 text-right font-semibold tabular-nums">€ ${parseFloat(inv.amount_tax_included || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="p-3 text-center">
                ${inv.attachment_url ?
            `<a href="${inv.attachment_url}" target="_blank" class="inline-flex items-center gap-1 text-primary hover:underline transition-colors" title="Apri Allegato">
                        <span class="material-icons-round text-sm">attach_file</span>
                        <span class="text-[10px] font-medium">PDF</span>
                    </a>` :
            '<span class="text-xs text-secondary/30">—</span>'
        }
            </td>
        </tr>
    `).join('');
}

function openSupplierModal(supplier = null) {
    const modal = document.getElementById('supplier-modal');
    const title = document.getElementById('supplier-modal-title');
    const form = document.getElementById('supplier-form');

    form.reset();
    document.getElementById('supplier-id').value = '';

    if (supplier) {
        title.textContent = 'Modifica Fornitore';
        document.getElementById('supplier-id').value = supplier.id;
        document.getElementById('supplier-name').value = supplier.name;
        document.getElementById('supplier-website').value = supplier.website || '';
        document.getElementById('supplier-notes').value = supplier.notes || '';
    } else {
        title.textContent = 'Nuovo Fornitore';
    }

    modal.classList.add('active');
}

async function saveSupplier() {
    const id = document.getElementById('supplier-id').value;
    const name = document.getElementById('supplier-name').value.trim();
    const website = document.getElementById('supplier-website').value.trim();
    const notes = document.getElementById('supplier-notes').value.trim();

    if (!name) {
        window.showAlert('Il nome è obbligatorio', 'warning');
        return;
    }

    const payload = {
        name,
        notes,
        // Only include website if the column likely exists or we handle error?
        // Let's assume user ran the SQL. If not, it will error "column not found"
        website: website || null
    };

    let error;
    if (id) {
        const res = await supabase.from('suppliers').update(payload).eq('id', id);
        error = res.error;
    } else {
        const res = await supabase.from('suppliers').insert(payload);
        error = res.error;
    }

    if (error) {
        console.error('Error saving supplier:', error);
        window.showAlert('Errore salvataggio: ' + error.message, 'error');
    } else {
        document.getElementById('supplier-modal').classList.remove('active');
        loadSuppliers();
    }
}

import { supabase } from '../modules/config.js';
import { renderModal, closeModal, showConfirm, formatAmount } from '../modules/utils.js?v=1001';

let chartInstance = null;
let statementsData = [];

export async function renderBankStatements(container) {
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
            <!-- LOADING STATE -->
            <div id="statements-loading" style="text-align: center; padding: 4rem;">
                <div class="loader" style="margin: 0 auto;"></div>
                <p style="margin-top: 1rem; color: var(--text-secondary);">Caricamento estratti conto...</p>
            </div>

            <!-- MAIN CONTENT -->
            <div id="statements-content" style="display: none;">
                <!-- TOP SECTION: UNIFIED BALANCE & CHART -->
                <div class="card" style="padding: 2rem; border-radius: 24px; border: 1px solid rgba(0,0,0,0.04); background: white; box-shadow: var(--shadow-sm); margin-bottom: 2rem;">
                    <div class="unified-chart-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
                        <div>
                            <div style="font-family: var(--font-titles); font-weight: 600; margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px;">Saldo Ultimo Estratto</div>
                            <div style="display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap;">
                                <div id="latest-balance-value" style="font-size: 3.2rem; font-weight: 700; letter-spacing: -0.04em; line-height: 1; color: var(--text-primary);">€ 0,00</div>
                                <div style="color: var(--text-secondary); font-size: 0.95rem; font-weight: 500; display: flex; align-items: center; gap: 0.4rem; background: #f8fafc; padding: 0.4rem 0.8rem; border-radius: 50px; border: 1px solid #f1f5f9;">
                                    <span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">event_available</span>  
                                    Registrato: <span id="latest-balance-date" style="color: var(--text-primary); font-weight: 600;">-</span>
                                </div>
                            </div>
                        </div>
                        <div class="chart-header-icon" style="width: 42px; height: 42px; background: #eff6ff; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: #3b82f6; font-size: 22px;">show_chart</span>
                        </div>
                    </div>
                    
                    <div style="height: 300px; width: 100%;">
                        <canvas id="balanceChart"></canvas>
                    </div>
                </div>

                <style>
                    @media (max-width: 768px) {
                        #latest-balance-value { font-size: 2.4rem !important; }
                        .unified-chart-header { flex-direction: column-reverse; align-items: flex-start; }
                        .chart-header-icon { display: none !important; } /* Hide icon on mobile to save space */
                    }
                </style>

                    <!-- ACTIONS ROW -->
                    <div class="bs-actions-row" style="display: flex; gap: 1rem; width: 100%;">
                        <button class="primary-btn secondary action-card-btn" id="generate-prima-nota-btn" style="border-radius: 16px; padding: 1.25rem; background: white; border: 1px solid rgba(0,0,0,0.04); color: var(--text-primary); font-size: 1rem; flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: var(--shadow-sm); cursor: pointer;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">receipt_long</span>
                            <span style="font-weight: 500;">Genera Prima Nota</span>
                        </button>
                        <button class="primary-btn secondary action-card-btn" id="archive-btn" style="border-radius: 16px; padding: 1.25rem; background: white; border: 1px solid rgba(0,0,0,0.04); color: var(--text-primary); font-size: 1rem; flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: var(--shadow-sm); cursor: pointer;">
                            <span class="material-icons-round" style="color: #64748b;">inventory_2</span>
                            <span style="font-weight: 500;">Archivio Estratti</span>
                        </button>
                        <button class="primary-btn action-card-btn" id="add-statement-btn" style="border-radius: 16px; padding: 1.25rem; font-size: 1rem; flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); cursor: pointer;">
                            <span class="material-icons-round">add</span>
                            <span style="font-weight: 500;">Nuovo Estratto</span>
                        </button>
                    </div>

                    <style>
                        .action-card-btn { transition: all 0.2s ease; }
                        .action-card-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
                        @media (max-width: 768px) {
                            .bs-actions-row { 
                                gap: 0.5rem !important; 
                            }
                            .action-card-btn {
                                flex-direction: column !important;
                                padding: 0.75rem 0.5rem !important;
                                gap: 0.4rem !important;
                                border-radius: 12px !important;
                            }
                            .action-card-btn span:last-child {
                                font-size: 0.7rem !important;
                                text-align: center;
                                line-height: 1.1;
                                white-space: normal;
                            }
                        }
                    </style>
                </div>
            </div>
        </div>
    `;

    const addBtn = document.getElementById('add-statement-btn');
    if (addBtn) addBtn.addEventListener('click', () => openStatementModal());

    const archiveBtn = document.getElementById('archive-btn');
    if (archiveBtn) archiveBtn.addEventListener('click', () => openArchiveModal());

    const primaNotaBtn = document.getElementById('generate-prima-nota-btn');
    if (primaNotaBtn) {
        primaNotaBtn.addEventListener('click', async () => {
            const confirmed = await window.showConfirm("Vuoi avviare la generazione della Prima Nota per l'ufficio contabilità?");
            if (!confirmed) return;

            const originalHTML = primaNotaBtn.innerHTML;
            primaNotaBtn.disabled = true;
            primaNotaBtn.innerHTML = '<span class="material-icons-round rotating">sync</span> Elaborazione...';

            try {
                // Use Supabase Edge Function to proxy the request and avoid CORS issues
                const { data: result, error: funcError } = await supabase.functions.invoke('trigger-webhook', {
                    body: {
                        webhookUrl: 'https://sacred-roughy-renewing.ngrok-free.app/webhook/08d69eda-8848-4c6d-9daa-a4a808eb398f',
                        payload: {
                            triggered_by: window.state?.profile?.full_name || 'Utente',
                            timestamp: new Date().toISOString()
                        }
                    }
                });

                if (funcError) throw funcError;

                // Handle both string and object responses (e.g. from n8n or proxy)
                const resultText = typeof result === 'string' ? result : JSON.stringify(result || {});
                const status = resultText.trim().toLowerCase();
                const isN8nStarted = status.includes("no respond to webhook node found") || status.includes("workflow was started");

                if (status.includes('done') || status.includes('accepted') || isN8nStarted) {
                    if (status.includes('done')) {
                        window.showAlert('Prima Nota generata con successo!', 'success');
                    } else {
                        window.showAlert('Generazione avviata in background. Riceverai una notifica al termine.', 'info');
                    }
                    // Notifications are handled by n8n calling 'notify-admins'
                } else {
                    throw new Error("Risposta inattesa dal server: " + resultText);
                }
            } catch (err) {
                console.error("Webhook trigger failed:", err);
                window.showAlert('Errore durante la generazione: ' + err.message, 'error');
            } finally {
                primaNotaBtn.disabled = false;
                primaNotaBtn.innerHTML = originalHTML;
            }
        });
    }

    await loadStatements();
}

async function loadStatements() {
    const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .order('statement_date', { ascending: false }); // Descending for table

    if (error) {
        console.error('Error loading statements:', error);
        document.getElementById('statements-loading').innerHTML = `
            <div style="color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5;">error_outline</span>
                <p>Errore nel caricamento degli estratti conto.</p>
            </div>
        `;
        return;
    }

    // Filter out auto-generated Imports
    const filteredData = data.filter(item => !item.name.startsWith('Import '));
    statementsData = filteredData;

    // Hide loading, show content
    document.getElementById('statements-loading').style.display = 'none';
    document.getElementById('statements-content').style.display = 'block';

    // Update KPIs
    updateKPIs(filteredData);

    // Render chart (ascending for chronological chart)
    const chartData = [...filteredData].reverse();
    renderChart(chartData);

    // Render table (descending - latest first)
    renderTable(filteredData);
}

function updateKPIs(data) {
    if (!data.length) {
        document.getElementById('latest-balance-value').textContent = '€ 0,00';
        document.getElementById('latest-balance-date').textContent = '-';
        return;
    }

    // Latest balance (first item since sorted desc)
    const latest = data[0];
    document.getElementById('latest-balance-value').textContent = `€ ${formatAmount(latest.balance)}`;
    document.getElementById('latest-balance-date').textContent = latest.statement_date ? new Date(latest.statement_date).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }) : '-';
}

function renderChart(data) {
    const canvas = document.getElementById('balanceChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(78, 146, 216, 0.3)');
    gradient.addColorStop(1, 'rgba(78, 146, 216, 0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.name), // MM/YY
            datasets: [{
                label: 'Saldo (€)',
                data: data.map(d => d.balance),
                borderColor: '#4e92d8',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#4e92d8',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointHoverBorderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#1e293b',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return 'Saldo: € ' + formatAmount(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0,0,0,0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11, weight: '500' },
                        color: '#64748b',
                        padding: 8,
                        callback: function (value) {
                            if (window.innerWidth < 768) {
                                if (value >= 1000 || value <= -1000) {
                                    return '€ ' + (value / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + 'k';
                                }
                                return '€ ' + value;
                            }
                            return '€ ' + formatAmount(value);
                        }
                    }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#64748b',
                        padding: 8
                    }
                }
            }
        }
    });
}

function renderTable(data) {
    const tbody = document.getElementById('statements-tbody');
    if (!tbody) return;

    if (!data.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 4rem;">
                    <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 2.5rem; color: var(--text-tertiary);">description</span>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 400;">Nessun estratto conto</h3>
                    <p style="color: var(--text-secondary); margin: 0;">Inizia aggiungendo il tuo primo estratto conto.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(item => {
        const balanceColor = item.balance >= 0 ? '#16a34a' : '#dc2626';
        const date = item.statement_date ? new Date(item.statement_date) : null;
        const dateStr = date ? date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        return `
            <tr class="statement-row" data-id="${item.id}" style="border-bottom: 1px solid var(--glass-border); transition: all 0.2s ease; cursor: pointer;">
                <td style="padding: 1.25rem 2rem;">
                    <span style="font-weight: 400; font-size: 0.95rem; color: var(--text-primary); font-family: 'Outfit', sans-serif;">${item.name || '-'}</span>
                </td>
                <td style="padding: 1.25rem 2rem;">
                    <span style="color: var(--text-secondary); font-size: 0.9rem;">${dateStr}</span>
                </td>
                <td style="padding: 1.25rem 2rem; text-align: right;">
                    <span style="font-weight: 400; font-size: 1.1rem; color: ${balanceColor};">
                        € ${formatAmount(item.balance)}
                    </span>
                </td>
                <td style="padding: 1.25rem 2rem;">
                    ${item.attachment_url ?
                `<a href="${item.attachment_url}" target="_blank" onclick="event.stopPropagation()" 
                           class="attachment-link" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--brand-blue); font-weight: 500; transition: all 0.2s;">
                            <span class="material-icons-round" style="font-size: 1.2rem;">description</span>
                            <span style="font-size: 0.9rem;">${item.attachment_name || 'Scarica'}</span>
                        </a>`
                : '<span style="opacity: 0.4; font-size: 0.85rem; color: var(--text-tertiary);">Nessun allegato</span>'
            }
                </td>
                <td style="padding: 1.25rem 2rem; text-align: right;">
                    <button class="icon-btn small delete-btn" data-id="${item.id}" title="Elimina" style="opacity: 0.6;">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: #ef4444;">delete</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add hover effects
    tbody.querySelectorAll('.statement-row').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(78, 146, 216, 0.03)';
            row.style.transform = 'translateX(4px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
            row.style.transform = 'translateX(0)';
        });
    });

    // Attachment link hover
    tbody.querySelectorAll('.attachment-link').forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.style.color = '#3b82f6';
            link.style.transform = 'translateX(2px)';
        });
        link.addEventListener('mouseleave', () => {
            link.style.color = 'var(--brand-blue)';
            link.style.transform = 'translateX(0)';
        });
    });

    // Delete buttons
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showConfirm('Sei sicuro di voler eliminare questo estratto conto?', { type: 'danger' })) {
                const id = e.currentTarget.dataset.id;
                await deleteStatement(id);
            }
        });
    });
}

async function deleteStatement(id) {
    const { error } = await supabase.from('bank_statements').delete().eq('id', id);
    if (error) {
        showAlert('Errore eliminazione: ' + error.message, 'error');
    } else {
        await loadStatements();
    }
}

function openArchiveModal() {
    const modalContent = `
        <div class="modal-header" style="padding: 2rem; border-bottom: 1px solid var(--glass-border);">
            <div>
                <h3 style="margin: 0; font-family: var(--font-titles); font-weight: 600; font-size: 1.4rem;">Archivio Estratti</h3>
                <p style="margin: 0.5rem 0 0; font-size: 0.9rem; color: var(--text-secondary);">Storico documenti ricaricati</p>
            </div>
            <button class="close-modal" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.05); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                <span class="material-icons-round" style="color: var(--text-secondary);">close</span>
            </button>
        </div>
        <div class="modal-body" style="padding: 0; max-height: 70vh; overflow-y: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background: var(--card-bg); z-index: 10; border-bottom: 2px solid var(--glass-border);">
                    <tr>
                        <th style="padding: 1rem 2rem; text-align: left; font-weight: 500; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Periodo</th>
                        <th style="padding: 1rem 2rem; text-align: left; font-weight: 500; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Data</th>
                        <th style="padding: 1rem 2rem; text-align: right; font-weight: 500; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Saldo</th>
                        <th style="padding: 1rem 2rem; text-align: left; font-weight: 500; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Allegato</th>
                        <th style="width: 60px;"></th>
                    </tr>
                </thead>
                <tbody id="statements-tbody">
                    <tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--text-tertiary);">Caricamento...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    renderModal('archive-modal', modalContent);
    renderTable(statementsData);

    document.querySelectorAll('#archive-modal .close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal('archive-modal'));
    });
}

function openStatementModal() {
    const modalContent = `
        <div class="modal-header" style="padding: 2rem; border-bottom: 1px solid var(--glass-border);">
            <div>
                <h3 style="margin: 0; font-family: var(--font-titles); font-weight: 400; font-size: 1.4rem;">Nuovo Estratto Conto</h3>
                <p style="margin: 0.5rem 0 0; font-size: 0.9rem; color: var(--text-secondary);">Carica l'estratto conto mensile e il relativo saldo finale.</p>
            </div>
            <button class="close-modal" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.05); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                <span class="material-icons-round" style="color: var(--text-secondary);">close</span>
            </button>
        </div>
        <div class="modal-body" style="padding: 2rem;">
            <form id="new-statement-form">
                <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="form-group">
                        <label style="display: block; font-weight: 400; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-primary);">Periodo (MM/YY) *</label>
                        <input type="text" name="name" required placeholder="es. 01/25" 
                               style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.95rem; transition: all 0.2s; background: var(--card-bg);">
                    </div>
                    <div class="form-group">
                        <label style="display: block; font-weight: 400; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-primary);">Data Fine Mese *</label>
                        <input type="date" name="statement_date" required
                               style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.95rem; transition: all 0.2s; background: var(--card-bg);">
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label style="display: block; font-weight: 400; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-primary);">Saldo Finale (€) *</label>
                        <input type="number" step="0.01" name="balance" required placeholder="0,00"
                               style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.95rem; transition: all 0.2s; background: var(--card-bg);">
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label style="display: block; font-weight: 400; margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--text-primary);">Allegato (PDF/Excel)</label>
                        <div class="file-upload-zone" id="upload-zone" 
                             style="border: 2px dashed var(--glass-border); padding: 2.5rem; border-radius: 16px; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(78, 146, 216, 0.02);">
                            <div style="width: 60px; height: 60px; background: rgba(78, 146, 216, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                                <span class="material-icons-round" style="font-size: 2rem; color: var(--brand-blue);">cloud_upload</span>
                            </div>
                            <p style="margin: 0; font-weight: 400; font-size: 0.95rem; color: var(--text-primary);">Trascina o clicca per caricare</p>
                            <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">PDF, Excel o CSV (max 10MB)</p>
                            <input type="file" id="file-input" hidden accept=".pdf,.xls,.xlsx,.csv">
                        </div>
                        <div id="file-preview" style="margin-top: 1rem; padding: 0.75rem 1rem; background: rgba(78, 146, 216, 0.05); border-radius: 10px; display: none; align-items: center; gap: 0.75rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">description</span>
                            <span id="file-name" style="flex: 1; font-size: 0.9rem; font-weight: 500;"></span>
                            <button type="button" id="remove-file" style="background: none; border: none; cursor: pointer; padding: 0.25rem;">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-tertiary);">close</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--glass-border); display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="primary-btn secondary cancel-btn" style="border-radius: 10px; min-width: 100px;">Annulla</button>
                    <button type="submit" class="primary-btn" id="save-btn" style="border-radius: 10px; min-width: 100px;">
                        <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                        Salva
                    </button>
                </div>
            </form>
        </div>
    `;

    renderModal('new-statement-modal', modalContent);

    // File Upload Logic
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fileName = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const saveBtn = document.getElementById('save-btn');
    let selectedFile = null;

    function handleFile(file) {
        selectedFile = file;
        fileName.textContent = file.name;
        filePreview.style.display = 'flex';
        uploadZone.style.borderColor = 'var(--brand-blue)';
        uploadZone.style.background = 'rgba(78, 146, 216, 0.05)';
    }

    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
        uploadZone.style.borderColor = 'var(--glass-border)';
        uploadZone.style.background = 'rgba(78, 146, 216, 0.02)';
    });

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--brand-blue)';
        uploadZone.style.background = 'rgba(78, 146, 216, 0.08)';
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--glass-border)';
        uploadZone.style.background = 'rgba(78, 146, 216, 0.02)';
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--glass-border)';
        uploadZone.style.background = 'rgba(78, 146, 216, 0.02)';
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Form submission
    document.getElementById('new-statement-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-icons-round rotating">sync</span> Salvataggio...';

        const formData = new FormData(e.target);
        const name = formData.get('name');
        const date = formData.get('statement_date');
        const balance = formData.get('balance');

        let attachmentUrl = null;
        let attachmentName = null;

        if (selectedFile) {
            const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const { data, error } = await supabase.storage
                .from('bank_statements')
                .upload(fileName, selectedFile);

            if (error) {
                showAlert('Errore caricamento file: ' + error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<span class="material-icons-round">save</span> Salva';
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('bank_statements')
                .getPublicUrl(fileName);

            attachmentUrl = publicUrl;
            attachmentName = selectedFile.name;
        }

        const { error } = await supabase.from('bank_statements').insert({
            name,
            statement_date: date,
            balance,
            attachment_url: attachmentUrl,
            attachment_name: attachmentName
        });

        if (error) {
            showAlert('Errore salvataggio: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round">save</span> Salva';
        } else {
            closeModal('new-statement-modal');
            await loadStatements();
        }
    });

    // Cancel button
    document.querySelectorAll('.cancel-btn, .close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal('new-statement-modal'));
    });
}

// Quick-capture FAB — bottone galleggiante per creare task velocemente
// da qualsiasi vista. Crea pm_item personale per l'utente loggato.

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const FAB_ID = 'quick-capture-fab';
const MODAL_ID = 'quick-capture-modal';

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export function mountQuickCaptureFab() {
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.title = 'Crea task veloce (Q)';
    fab.innerHTML = `<span class="material-icons-round" style="font-size:1.6rem;">add</span>`;
    fab.style.cssText = `
        position: fixed; right: 1.5rem; bottom: 1.5rem;
        width: 56px; height: 56px; border-radius: 28px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff; border: none; cursor: pointer;
        box-shadow: 0 8px 24px rgba(99,102,241,.35), 0 2px 8px rgba(0,0,0,.06);
        display: flex; align-items: center; justify-content: center;
        z-index: 998; transition: transform .15s, box-shadow .15s;
    `;
    fab.onmouseenter = () => {
        fab.style.transform = 'translateY(-2px) scale(1.05)';
        fab.style.boxShadow = '0 12px 30px rgba(99,102,241,.45)';
    };
    fab.onmouseleave = () => {
        fab.style.transform = '';
        fab.style.boxShadow = '0 8px 24px rgba(99,102,241,.35), 0 2px 8px rgba(0,0,0,.06)';
    };
    fab.onclick = openQuickCapture;
    document.body.appendChild(fab);

    // Keyboard shortcut: tasto Q quando non si sta scrivendo
    document.addEventListener('keydown', ev => {
        if ((ev.key === 'q' || ev.key === 'Q') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
            const target = ev.target;
            const isTyping = target && (
                target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            );
            if (isTyping) return;
            ev.preventDefault();
            openQuickCapture();
        }
    });
}

function openQuickCapture() {
    if (document.getElementById(MODAL_ID)) return;
    const userId = state.profile?.id;
    if (!userId) { alert('Non autenticato'); return; }

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:15vh;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:520px;width:90%;padding:1.5rem 1.75rem;box-shadow:0 20px 60px rgba(0,0,0,.2);">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;">
                <span class="material-icons-round" style="color:#8b5cf6;font-size:1.3rem;">flash_on</span>
                <h3 style="margin:0;font-size:1.1rem;color:#1f2937;">Cattura veloce</h3>
            </div>

            <input id="qc-title" type="text" placeholder="Cosa devi fare?" autocomplete="off"
                style="width:100%;padding:.75rem .9rem;border:1px solid #e5e7eb;border-radius:10px;font-size:1rem;margin-bottom:.85rem;box-sizing:border-box;">

            <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
                <button class="qc-due" data-days="0" style="padding:.4rem .75rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff;font-size:.78rem;cursor:pointer;">Oggi</button>
                <button class="qc-due" data-days="1" style="padding:.4rem .75rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff;font-size:.78rem;cursor:pointer;">Domani</button>
                <button class="qc-due" data-days="7" style="padding:.4rem .75rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff;font-size:.78rem;cursor:pointer;">+7gg</button>
                <input type="date" id="qc-due-custom" style="padding:.4rem .65rem;border:1px solid #e5e7eb;border-radius:999px;font-size:.78rem;">
                <select id="qc-priority" style="padding:.4rem .75rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff;font-size:.78rem;cursor:pointer;">
                    <option value="medium">Media</option>
                    <option value="low">Bassa</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                </select>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:.7rem;color:#9ca3af;">↵ per salvare · Esc per chiudere</div>
                <div style="display:flex;gap:.5rem;">
                    <button id="qc-cancel" style="padding:.5rem 1rem;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:.85rem;">Annulla</button>
                    <button id="qc-save" style="padding:.5rem 1.2rem;border:none;border-radius:8px;background:#8b5cf6;color:#fff;cursor:pointer;font-weight:500;font-size:.85rem;">Salva task</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
    modal.querySelector('#qc-cancel').addEventListener('click', close);

    const input = modal.querySelector('#qc-title');
    setTimeout(() => input.focus(), 50);

    let selectedDate = null;

    modal.querySelectorAll('.qc-due').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.qc-due').forEach(b => {
                b.style.background = '#fff';
                b.style.color = '#374151';
                b.style.borderColor = '#e5e7eb';
            });
            btn.style.background = '#8b5cf6';
            btn.style.color = '#fff';
            btn.style.borderColor = '#8b5cf6';
            const days = parseInt(btn.dataset.days, 10);
            const d = new Date();
            d.setDate(d.getDate() + days);
            selectedDate = d.toISOString().split('T')[0];
            modal.querySelector('#qc-due-custom').value = selectedDate;
        });
    });

    modal.querySelector('#qc-due-custom').addEventListener('change', ev => {
        selectedDate = ev.target.value || null;
        modal.querySelectorAll('.qc-due').forEach(b => {
            b.style.background = '#fff';
            b.style.color = '#374151';
            b.style.borderColor = '#e5e7eb';
        });
    });

    const save = async () => {
        const title = input.value.trim();
        if (!title) { input.focus(); return; }
        const priority = modal.querySelector('#qc-priority').value;
        const btn = modal.querySelector('#qc-save');
        btn.disabled = true;
        btn.textContent = 'Salvo…';

        const { error } = await supabase.from('pm_items').insert({
            title,
            due_date: selectedDate,
            priority,
            status: 'todo',
            item_type: 'task',
            pm_user_ref: userId,
            created_by_user_ref: userId,
        });

        if (error) {
            btn.disabled = false;
            btn.textContent = 'Salva task';
            alert('Errore: ' + error.message);
            return;
        }

        // Trigger refresh in viste che ascoltano
        document.dispatchEvent(new CustomEvent('pm-item-changed'));
        close();
    };

    modal.querySelector('#qc-save').addEventListener('click', save);
    input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') save();
        if (ev.key === 'Escape') close();
    });
    modal.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') close();
    });
}

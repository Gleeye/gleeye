import { supabase } from './modules/config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const formId = urlParams.get('id');

    const wrapper = document.getElementById('form-wrapper');
    const loading = document.getElementById('loading');
    const formEl = document.getElementById('public-form');
    const submitBtn = document.getElementById('submit-btn');
    const successState = document.getElementById('success-state');
    const successMsg = document.getElementById('success-msg');
    const errorEl = document.getElementById('error-msg');

    if (!formId) {
        showError('ID Modulo mancante nell\'URL.');
        return;
    }

    try {
        const { data, error } = await supabase.from('contact_forms').select('*').eq('id', formId).single();
        console.log('Fetched Form Data:', data);

        if (error || !data) throw new Error('Modulo non trovato o non più disponibile.');
        if (!data.is_active) throw new Error('Questo modulo di contatto è stato disattivato.');

        const fields = data.fields || [];
        console.log('Fields count:', fields.length);
        // Apply primary color
        if (data.primary_color) {
            document.documentElement.style.setProperty('--primary-color', data.primary_color);
        }

        let steps = [];

        // 1. Welcome Screen
        if (data.has_welcome_screen && data.welcome_title) {
            steps.push({
                type: 'welcome',
                title: data.welcome_title,
                desc: data.welcome_description,
                btn: data.welcome_button_text || 'Inizia'
            });
        }

        if (fields.length === 0) throw new Error('Questo modulo non ha alcun campo configurato.');

        fields.forEach(f => steps.push({ ...f, isField: true }));

        const typeformWrapper = document.getElementById('typeform-wrapper');
        const progressBar = document.getElementById('progress-bar');
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');

        let currentStepIndex = 0;

        const stepsHtml = steps.map((s, i) => {
            const isFirst = i === 0;
            const isLast = i === steps.length - 1;
            const stepNumText = s.type === 'welcome' || s.type === 'step' || s.type === 'html' ? '' : `<span class="question-number">${i + (data.has_welcome_screen ? 0 : 1)} <span style="color:rgba(0,0,0,0.2);">&rarr;</span></span>`;

            let content = '';

            if (s.type === 'welcome') {
                content = `
                    <div class="center-vh" style="width: 100%;">
                        <h1 class="welcome-title">${s.title.replace(/"/g, '&quot;')}</h1>
                        ${s.desc ? `<p class="question-desc" style="max-width: 600px; font-size: 1.25rem;">${s.desc.replace(/\n/g, '<br>')}</p>` : ''}
                        <button type="button" class="btn-action next-btn-trigger" style="margin-top: 2rem;">${s.btn}</button>
                        <div class="next-hint" style="margin-top: 1rem;">presta <strong>Invio &crarr;</strong></div>
                    </div>
                `;
            } else if (s.isField) {
                const reqText = s.required ? ' <span style="color: #ef4444; font-size: 0.8em; vertical-align: super;">*</span>' : '';

                let inputHtml = '';
                const baseId = `field_${s.id}`;

                if (s.type === 'text' || s.type === 'email' || s.type === 'tel' || s.type === 'url' || s.type === 'number' || s.type === 'password') {
                    inputHtml = `
                        <input type="${s.type === 'password' ? 'password' : s.type === 'email' ? 'email' : s.type === 'number' ? 'number' : 'text'}" 
                               class="tf-input step-input" 
                               id="${baseId}" name="${baseId}" 
                               placeholder="${(s.placeholder || 'Scrivi la tua risposta qui...').replace(/"/g, '&quot;')}" 
                               ${s.required ? 'required' : ''}>
                    `;
                } else if (s.type === 'textarea') {
                    inputHtml = `
                        <textarea class="tf-input step-input" 
                                  id="${baseId}" name="${baseId}" 
                                  rows="2"
                                  placeholder="${(s.placeholder || 'Scrivi qui la tua risposta...').replace(/"/g, '&quot;')}" 
                                  ${s.required ? 'required' : ''}
                                  style="resize: none; overflow: hidden; min-height: 2em;"></textarea>
                    `;
                } else if (s.type === 'select') {
                    inputHtml = `
                        <div style="display: flex; flex-direction: column; width: 100%;">
                            <select class="tf-input step-input" id="${baseId}" name="${baseId}" ${s.required ? 'required' : ''} style="margin-bottom: 1rem;">
                                <option value="" disabled selected>Scegli un'opzione...</option>
                                ${(s.options || []).map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">${opt}</option>`).join('')}
                            </select>
                        </div>
                    `;
                } else if (s.type === 'radio') {
                    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    inputHtml = `
                        <div style="display: flex; flex-direction: column; width: 100%;">
                            ${(s.options || []).map((opt, idx) => `
                                <label class="tf-choice radio-choice">
                                    <div class="tf-key-hint">${letters[idx] || ''}</div>
                                    <input type="radio" name="${baseId}" value="${opt.replace(/"/g, '&quot;')}" class="step-input visually-hidden" style="display:none;" ${s.required ? 'required' : ''}>
                                    <span>${opt}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                } else if (s.type === 'checkbox') {
                    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    inputHtml = `
                        <div style="display: flex; flex-direction: column; width: 100%;">
                            ${(s.options || []).map((opt, idx) => `
                                <label class="tf-choice checkbox-choice">
                                    <div class="tf-key-hint">${letters[idx] || ''}</div>
                                    <input type="checkbox" name="${baseId}" value="${opt.replace(/"/g, '&quot;')}" class="step-input visually-hidden" style="display:none;">
                                    <span>${opt}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                } else if (s.type === 'acceptance') {
                    inputHtml = `
                        <label class="tf-choice checkbox-choice">
                            <div class="tf-key-hint">Y</div>
                            <input type="checkbox" name="${baseId}" value="accettato" class="step-input visually-hidden" style="display:none;" ${s.required ? 'required' : ''}>
                            <span>Si, accetto</span>
                        </label>
                    `;
                } else if (s.type === 'html') {
                    inputHtml = `<div style="color: var(--text-secondary); font-size: 1.2rem; line-height: 1.6;">${s.html_content || ''}</div>`;
                } else if (s.type === 'step') {
                    inputHtml = ``;
                } else if (s.type === 'hidden' || s.type === 'recaptcha' || s.type === 'recaptcha_v3' || s.type === 'honeypot') {
                    return `<div class="step-container" data-index="${i}" data-hidden="true"><input type="hidden" name="${baseId}" value="hidden_or_empty"></div>`;
                } else {
                    inputHtml = `<input type="text" class="tf-input step-input" id="${baseId}" name="${baseId}" ${s.required ? 'required' : ''}>`;
                }

                content = `
                    <div class="tf-question-wrapper">
                        <h2 class="question-title">${stepNumText} <span>${s.label}${reqText}</span></h2>
                        ${s.description ? `<p class="question-desc">${s.description.replace(/\n/g, '<br>')}</p>` : ''}
                        
                        <div class="tf-input-container">
                            ${inputHtml}
                        </div>

                        ${s.type !== 'html' && s.type !== 'step' ? `
                        <div class="tf-action-row">
                            ${!isLast ? `<button type="button" class="btn-action next-btn-trigger">OK <span class="material-icons-round" style="font-size:1.2rem; margin-left:8px;">check</span></button>`
                            : `<button type="button" class="btn-action submit-btn-trigger">Invia <span class="material-icons-round" style="font-size:1.2rem; margin-left:8px;">send</span></button>`}
                            ${!isLast ? `<div class="next-hint">presta <strong>Invio &crarr;</strong></div>` : ''}
                        </div>
                        ` : `
                        <div class="tf-action-row">
                            <button type="button" class="btn-action next-btn-trigger">Continua</button>
                        </div>
                        `}
                    </div>
                `;
            }

            return `
                <div class="step-container" data-index="${i}" data-type="${s.type}">
                    ${content}
                </div>
            `;
        }).join('');

        typeformWrapper.innerHTML = stepsHtml;

        // Auto resize textarea
        document.querySelectorAll('textarea.tf-input').forEach(el => {
            el.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        });

        const stepContainers = document.querySelectorAll('.step-container:not([data-hidden="true"])');
        let activeSteps = Array.from(stepContainers).filter(s => s.dataset.hidden !== 'true');

        const updateView = () => {
            activeSteps.forEach((el, index) => {
                el.classList.remove('active', 'past', 'future');
                if (index === currentStepIndex) {
                    el.classList.add('active');
                    setTimeout(() => {
                        const input = el.querySelector('.step-input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
                        if (input) input.focus();
                    }, 500); // Wait for transition
                } else if (index < currentStepIndex) {
                    el.classList.add('past');
                } else {
                    el.classList.add('future');
                }
            });

            const totalProgressableSteps = activeSteps.length - (data.has_welcome_screen ? 1 : 0);
            const currentProgressStep = currentStepIndex - (data.has_welcome_screen ? 1 : 0);
            let progress = 0;
            if (activeSteps.length > 1) {
                progress = totalProgressableSteps > 0 ? (Math.max(0, currentProgressStep) / (totalProgressableSteps - 1)) * 100 : 100;
            } else {
                progress = 100;
            }
            if (currentStepIndex === 0 && data.has_welcome_screen) progress = 0;
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;

            btnPrev.disabled = currentStepIndex === 0;
            btnNext.disabled = currentStepIndex === activeSteps.length - 1;

            notifyResize();
        };

        const showErrorPulse = () => {
            const currentEl = activeSteps[currentStepIndex];
            if (currentEl) {
                currentEl.style.transform = 'translate(-50%, -50%) translateX(10px)';
                setTimeout(() => currentEl.style.transform = 'translate(-50%, -50%) translateX(-10px)', 100);
                setTimeout(() => currentEl.style.transform = 'translate(-50%, -50%) translateX(10px)', 200);
                setTimeout(() => currentEl.style.transform = 'translate(-50%, -50%) translateX(0)', 300);
            }
        };

        const validateCurrentStep = () => {
            const currentEl = activeSteps[currentStepIndex];
            const inputs = currentEl.querySelectorAll('input[required], select[required], textarea[required]');
            let isValid = true;
            inputs.forEach(inp => {
                if (inp.type === 'radio' || inp.type === 'checkbox') {
                    const name = inp.name;
                    const checked = currentEl.querySelector(`input[name="${name}"]:checked`);
                    if (!checked) isValid = false;
                } else {
                    if (!inp.value.trim()) isValid = false;
                }
            });

            if (!isValid) {
                showErrorPulse();
                return false;
            }
            return true;
        };

        const goNext = () => {
            if (currentStepIndex < activeSteps.length - 1) {
                if (validateCurrentStep()) {
                    currentStepIndex++;
                    updateView();
                }
            }
        };

        const goPrev = () => {
            if (currentStepIndex > 0) {
                currentStepIndex--;
                updateView();
            }
        };

        btnNext.addEventListener('click', goNext);
        btnPrev.addEventListener('click', goPrev);

        document.querySelectorAll('.next-btn-trigger').forEach(btn => btn.addEventListener('click', goNext));

        // Submit button trigger
        document.querySelectorAll('.submit-btn-trigger').forEach(btn => {
            btn.addEventListener('click', () => {
                if (validateCurrentStep()) {
                    formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            });
        });

        // Choice selection visual updates
        document.querySelectorAll('.tf-choice').forEach(choice => {
            choice.addEventListener('click', (e) => {
                const input = choice.querySelector('input');
                if (!input) return;

                if (input.type === 'radio') {
                    const name = input.name;
                    // trigger change
                    choice.closest('.step-container').querySelectorAll('.tf-choice').forEach(c => c.classList.remove('selected'));
                    choice.classList.add('selected');
                    input.checked = true;
                    // Auto advance slightly after selection
                    setTimeout(() => goNext(), 500);
                } else if (input.type === 'checkbox') {
                    if (e.target !== input) {
                        input.checked = !input.checked;
                    }
                    if (input.checked) choice.classList.add('selected');
                    else choice.classList.remove('selected');
                }
            });
            const pInput = choice.querySelector('input');
            if (pInput) {
                pInput.addEventListener('click', (e) => e.stopPropagation());
                pInput.addEventListener('change', () => {
                    if (pInput.type === 'checkbox') {
                        if (pInput.checked) choice.classList.add('selected');
                        else choice.classList.remove('selected');
                    }
                });
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeEl = activeSteps[currentStepIndex];
                if (!activeEl) return;
                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                if (activeTag === 'textarea' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    return; // let them write new lines
                }
                e.preventDefault();

                if (currentStepIndex === activeSteps.length - 1) {
                    if (validateCurrentStep()) formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                } else {
                    goNext();
                }
            }

            // Keyboard shortcuts A,B,C... for choices
            if (e.key.match(/^[a-zA-Z]$/)) {
                const activeEl = activeSteps[currentStepIndex];
                if (!activeEl) return;

                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                if (activeTag === 'input' && document.activeElement.type !== 'radio' && document.activeElement.type !== 'checkbox') return;
                if (activeTag === 'textarea') return;

                const char = e.key.toUpperCase();
                const choiceHints = activeEl.querySelectorAll('.tf-key-hint');
                choiceHints.forEach((hint) => {
                    if (hint.textContent === char) {
                        const wrapper = hint.closest('.tf-choice');
                        if (wrapper) wrapper.click();
                    }
                });
            }
        });

        // Show form & init view
        loading.style.display = 'none';
        formEl.style.display = 'block';
        updateView();

        // Handle submit
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnSubmit = activeSteps[activeSteps.length - 1].querySelector('.submit-btn-trigger');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<span class="loader small" style="width: 20px; height: 20px; border-width: 2px; border-top-color: white;"></span>';
            }
            errorEl.style.display = 'none';

            const formData = new FormData(formEl);
            const payload = {};

            // hidden inputs mapping
            document.querySelectorAll('.step-container[data-hidden="true"] input').forEach(inp => {
                payload[inp.name] = inp.value;
            });

            // Capture extra URL params 
            for (const [paramKey, paramVal] of urlParams.entries()) {
                if (paramKey !== 'id') payload[paramKey] = paramVal;
            }

            for (let [key, value] of formData.entries()) {
                if (payload[key]) {
                    if (Array.isArray(payload[key])) {
                        payload[key].push(value);
                    } else {
                        payload[key] = [payload[key], value];
                    }
                } else {
                    payload[key] = value;
                }
            }

            const { error: submitErr } = await supabase.from('contact_submissions').insert([{
                form_id: formId,
                data: payload,
                is_read: false
            }]);

            if (submitErr) {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = 'Riprova <span class="material-icons-round" style="font-size:1.2rem; margin-left:8px;">send</span>';
                }
                showError('Si è verificato un errore durante l\'invio. Riprova tra poco.');
                console.error(submitErr);
            } else {
                formEl.style.display = 'none';
                document.getElementById('progress-container').style.display = 'none';

                successState.style.display = 'flex';
                successState.classList.add('center-vh');
                successState.style.height = '100%';

                if (data.success_message) {
                    successMsg.textContent = data.success_message;
                }
                notifyResize();
                window.parent.postMessage({ type: 'form_submitted', success: true }, '*');
            }
        });

    } catch (err) {
        showError(err.message);
        notifyResize();
    }

    function showError(msg) {
        loading.style.display = 'none';
        formEl.style.display = 'none';
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }

    // Auto-resize logic to inform parent iframe
    function notifyResize() {
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: 'resize_iframe', height }, '*');
    }

    const resizeObserver = new ResizeObserver(() => notifyResize());
    resizeObserver.observe(document.body);

    // Listen for style sync from parent
    window.addEventListener('message', (event) => {
        if (event.data.type === 'apply_styles' && event.data.styles) {
            const s = event.data.styles;
            if (s.fontFamily) document.documentElement.style.setProperty('--font-family', s.fontFamily);
            if (s.primaryColor) document.documentElement.style.setProperty('--primary-color', s.primaryColor);
            if (s.textColor) document.documentElement.style.setProperty('--text-primary', s.textColor);
            if (s.bgColor) {
                document.getElementById('form-wrapper').style.background = s.bgColor;
                // If background is very dark, tweak text as well if needed
            }
        }
    });

    // Request styles from parent on load
    window.parent.postMessage({ type: 'ready_for_styles' }, '*');
});

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

        let currentStepGroup = { type: 'fields', fields: [], title: '', desc: '' };
        fields.forEach((f) => {
            if (f.type === 'step') {
                if (currentStepGroup.fields.length > 0) {
                    steps.push(currentStepGroup);
                }
                currentStepGroup = { type: 'fields', fields: [], title: f.label || '', desc: f.description || '' };
            } else {
                currentStepGroup.fields.push(f);
            }
        });
        if (currentStepGroup.fields.length > 0) {
            steps.push(currentStepGroup);
        }

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
                    <div class="tf-question-wrapper center-vh">
                        <h1 class="welcome-title">${s.title}</h1>
                        <p class="question-desc">${s.desc}</p>
                        <div class="tf-action-row" style="display: flex; align-items: center; gap: 20px;">
                            <button type="button" class="btn-action next-btn-trigger">${s.btn || 'Inizia'}</button>
                            ${!isFirst ? `<button type="button" class="text-btn prev-btn-trigger" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:600; font-family:inherit;">&larr; Indietro</button>` : ''}
                        </div>
                        <div class="next-hint" style="margin-top: 1rem; opacity: 0.6; font-size: 0.8rem;">o premi <strong>Invio &crarr;</strong></div>
                    </div>
                `;
            } else if (s.type === 'fields') {
                const fieldsHtml = s.fields.map((f, fRowIdx) => {
                    if (f.type === 'hidden' || f.type === 'recaptcha' || f.type === 'recaptcha_v3' || f.type === 'honeypot') {
                        return `<input type="hidden" name="field_${f.id}" value="hidden_or_empty">`;
                    }

                    const reqText = f.required ? ' <span style="color: #ef4444; font-size: 0.8em; vertical-align: super;">*</span>' : '';
                    let inputHtml = '';
                    const baseId = `field_${f.id}`;

                    if (f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'url' || f.type === 'number' || f.type === 'password') {
                        inputHtml = `<input type="${f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'}" class="tf-input step-input" id="${baseId}" name="${baseId}" placeholder="${(f.placeholder || 'Scrivi la tua risposta qui...').replace(/"/g, '&quot;')}" ${f.required ? 'required' : ''}>`;
                    } else if (f.type === 'textarea') {
                        inputHtml = `<textarea class="tf-input step-input" id="${baseId}" name="${baseId}" rows="1" placeholder="${(f.placeholder || 'Scrivi qui la tua risposta...').replace(/"/g, '&quot;')}" ${f.required ? 'required' : ''} style="resize: none; overflow: hidden; min-height: 2em;"></textarea>`;
                    } else if (f.type === 'select') {
                        inputHtml = `<select class="tf-input step-input" id="${baseId}" name="${baseId}" ${f.required ? 'required' : ''} style="margin-bottom: 0.5rem;"><option value="" disabled selected>Scegli un'opzione...</option>${(f.options || []).map(opt => `<option value="${opt.replace(/"/g, '&quot;')}">${opt}</option>`).join('')}</select>`;
                    } else if (f.type === 'radio' || f.type === 'checkbox') {
                        inputHtml = `
                            <div class="tf-choices-container" style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
                                ${(f.options || []).map((opt, idx) => `
                                    <label class="tf-choice ${f.type}-choice" data-type="${f.type}">
                                        <div class="tf-choice-indicator ${f.type}-indicator">
                                            <div class="tf-inner-mark"></div>
                                        </div>
                                        <input type="${f.type}" name="${baseId}${f.type === 'checkbox' ? '[]' : ''}" value="${opt.replace(/"/g, '&quot;')}" class="step-input" style="position: absolute; opacity: 0; width: 0; height: 0;" ${f.required && f.type === 'radio' ? 'required' : ''}>
                                        <span class="tf-choice-label">${opt}</span>
                                    </label>
                                `).join('')}
                            </div>
                        `;
                    } else if (f.type === 'acceptance') {
                        inputHtml = `<label class="tf-choice checkbox-choice"><div class="tf-key-hint">Y</div><input type="checkbox" name="${baseId}" value="accettato" class="step-input visually-hidden" style="display:none;" ${f.required ? 'required' : ''}><span>Si, accetto</span></label>`;
                    } else if (f.type === 'html') {
                        inputHtml = `<div style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6; margin-top: 1rem;">${f.html_content || ''}</div>`;
                    }

                    const width = f.width || '100%';
                    const flexBasis = width.includes('%') ? width : '100%';

                    return `
                        <div class="field-row" style="flex: 0 0 ${flexBasis}; max-width: ${flexBasis}; margin-bottom: 2.5rem; padding-right: ${flexBasis === '100%' ? '0' : '15px'}; box-sizing: border-box;">
                            ${f.type !== 'html' ? `<h2 class="question-title" style="font-size: 1.15rem; margin-bottom: 0.75rem; font-weight: 500;">${f.label}${reqText}</h2>` : ''}
                            ${f.description ? `<p class="question-desc" style="font-size: 0.9rem; margin-bottom: 0.75rem; opacity: 0.8;">${f.description.replace(/\n/g, '<br>')}</p>` : ''}
                            <div class="tf-input-container" style="margin-top: 0;">${inputHtml}</div>
                        </div>
                    `;
                }).join('');

                let formHeaderHtml = '';
                if (i === 0 && !data.has_welcome_screen) {
                    formHeaderHtml = `
                        <div style="margin-bottom: 3.5rem; padding-bottom: 2rem; border-bottom: 2px solid rgba(var(--primary-rgb, 13, 110, 253), 0.1);">
                            <h1 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-primary);">${data.name}</h1>
                            ${data.description ? `<p style="font-size: 1.1rem; color: var(--text-secondary); margin: 0; opacity: 0.7;">${data.description}</p>` : ''}
                        </div>
                    `;
                }

                content = `
                    <div class="tf-question-wrapper" style="max-width: 900px;">
                        ${formHeaderHtml}
                        ${s.title ? `<h1 class="step-title" style="font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-primary);">${s.title}</h1>` : ''}
                        ${s.desc ? `<p class="step-desc" style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 3rem;">${s.desc}</p>` : ''}
                        
                        <div class="fields-grid" style="display: flex; flex-wrap: wrap; width: 100%; margin: 0 -15px 0 0;">
                            ${fieldsHtml}
                        </div>

                        <div class="tf-action-row" style="margin-top: 1rem; width: 100%; display: flex; align-items: center; gap: 20px;">
                            ${!isLast ? `<button type="button" class="btn-action next-btn-trigger">Continua <span class="material-icons-round" style="font-size:1.2rem; margin-left:8px;">arrow_forward</span></button>`
                        : `<button type="button" class="btn-action submit-btn-trigger">Invia <span class="material-icons-round" style="font-size:1.2rem; margin-left:8px;">send</span></button>`}
                            
                            ${!isFirst ? `<button type="button" class="text-btn prev-btn-trigger" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:600; font-family:inherit; font-size: 1rem;">Indietro</button>` : ''}
                            
                            ${!isLast ? `<div class="next-hint" style="opacity: 0.6; font-size: 0.8rem;">o premi <strong>Invio &crarr;</strong></div>` : ''}
                        </div>
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
                currentEl.classList.add('shake-error');
                setTimeout(() => currentEl.classList.remove('shake-error'), 500);
            }
        };

        const validateCurrentStep = () => {
            const currentEl = activeSteps[currentStepIndex];
            if (!currentEl) return true;

            const inputs = currentEl.querySelectorAll('input[required], select[required], textarea[required]');
            let isValid = true;
            let firstInvalid = null;

            inputs.forEach(inp => {
                let fieldValid = true;
                if (inp.type === 'radio' || inp.type === 'checkbox') {
                    const name = inp.name;
                    // For groups, check if at least one is checked
                    const checked = currentEl.querySelector(`input[name="${name.replace(/\[\]$/, '\\[\\]')}"]:checked`);
                    if (!checked) fieldValid = false;
                } else {
                    if (!inp.value.trim()) fieldValid = false;
                }

                if (!fieldValid) {
                    isValid = false;
                    if (!firstInvalid) firstInvalid = inp;
                    // Highlight the field row
                    const row = inp.closest('.field-row');
                    if (row) {
                        row.classList.add('field-error');
                        setTimeout(() => row.classList.remove('field-error'), 2000);
                    }
                }
            });

            if (!isValid) {
                console.log('[Validation] Step invalid. Missing fields.');
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
        document.querySelectorAll('.prev-btn-trigger').forEach(btn => btn.addEventListener('click', goPrev));

        // Submit button trigger
        document.querySelectorAll('.submit-btn-trigger').forEach(btn => {
            btn.addEventListener('click', () => {
                if (validateCurrentStep()) {
                    formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            });
        });

        // Choice selection visual updates
        document.querySelectorAll('.tf-choice input').forEach(input => {
            input.addEventListener('change', () => {
                const choice = input.closest('.tf-choice');
                const type = choice.dataset.type;
                const container = choice.closest('.tf-choices-container');

                if (type === 'radio') {
                    container.querySelectorAll('.tf-choice').forEach(c => c.classList.remove('selected'));
                    if (input.checked) {
                        choice.classList.add('selected');
                        // Auto advance ONLY if it's the only field in the step
                        const currentStep = steps[currentStepIndex];
                        if (currentStep && currentStep.type === 'fields' && currentStep.fields.length === 1) {
                            setTimeout(() => goNext(), 500);
                        }
                    }
                } else {
                    // Checkbox toggle state
                    if (input.checked) choice.classList.add('selected');
                    else choice.classList.remove('selected');
                }
            });
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
            // Keyboard shortcuts removed as requested (no more letters)
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

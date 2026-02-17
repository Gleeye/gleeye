export class CustomSelect {
    constructor(element) {
        this.originalSelect = element;
        this.customSelect = null;
        this.trigger = null;
        this.optionsContainer = null;

        this.init();
    }

    init() {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.classList.add('custom-select-wrapper');

        // Hide original select and move into wrapper
        this.originalSelect.parentNode.insertBefore(wrapper, this.originalSelect);
        wrapper.appendChild(this.originalSelect);

        // Create Trigger
        this.trigger = document.createElement('div');
        this.trigger.classList.add('custom-select-trigger');
        // Initial state
        this.updateTrigger();

        const arrow = document.createElement('span');
        arrow.classList.add('custom-select-arrow', 'material-icons-round');
        arrow.textContent = 'expand_more';
        this.trigger.appendChild(arrow);

        wrapper.appendChild(this.trigger);

        // Create Options Container
        this.optionsContainer = document.createElement('div');
        this.optionsContainer.classList.add('custom-options');
        wrapper.appendChild(this.optionsContainer);

        this.customSelect = wrapper;

        // Populate options
        this.refreshOptions();

        // Event Listeners
        this.trigger.addEventListener('click', (e) => {
            const isOpen = this.customSelect.classList.contains('open');

            // Close other open selects
            document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
                if (el !== this.customSelect) {
                    el.classList.remove('open');
                    const parentCard = el.closest('.glass-card');
                    if (parentCard) parentCard.style.zIndex = '';
                }
            });

            this.customSelect.classList.toggle('open');

            // Manage parent card z-index to avoid clipping under sibling cards
            const parentCard = this.customSelect.closest('.glass-card');
            if (parentCard) {
                if (!isOpen) { // We are opening it now
                    parentCard.style.zIndex = '100';
                } else {
                    parentCard.style.zIndex = '';
                }
            }

            e.stopPropagation();
        });

        // Close on click outside
        window.addEventListener('click', (e) => {
            if (!this.customSelect.contains(e.target)) {
                if (this.customSelect.classList.contains('open')) {
                    const parentCard = this.customSelect.closest('.glass-card');
                    if (parentCard) parentCard.style.zIndex = '';
                }
                this.customSelect.classList.remove('open');
            }
        });

        // Listen for external changes to original select
        this.originalSelect.addEventListener('change', () => {
            this.updateTrigger();
            // Update selected visual state in custom options
            this.optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.value === this.originalSelect.value) {
                    opt.classList.add('selected');
                }
            });
        });
    }

    refreshOptions() {
        this.optionsContainer.innerHTML = '';

        Array.from(this.originalSelect.options).forEach(option => {
            const customOption = document.createElement('div');
            customOption.classList.add('custom-option');
            customOption.dataset.value = option.value;

            // Add Dot if present
            const dotColor = option.dataset.dot;
            if (dotColor) {
                const dot = document.createElement('div');
                dot.classList.add('select-dot');
                dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; margin-right: 12px; flex-shrink: 0; box-shadow: 0 0 8px ${dotColor}40;`;
                customOption.appendChild(dot);
                customOption.style.display = 'flex';
                customOption.style.alignItems = 'center';
            }

            const text = document.createElement('span');
            text.textContent = option.textContent;
            customOption.appendChild(text);

            if (option.selected) {
                customOption.classList.add('selected');
            }

            customOption.addEventListener('click', (e) => {
                this.originalSelect.value = customOption.dataset.value;
                this.updateTrigger();

                // Visual update
                this.optionsContainer.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
                customOption.classList.add('selected');

                this.customSelect.classList.remove('open');

                // Reset parent z-index
                const parentCard = this.customSelect.closest('.glass-card');
                if (parentCard) parentCard.style.zIndex = '';

                // Trigger change event on original select to fire app logic
                const event = new Event('change', { bubbles: true });
                this.originalSelect.dispatchEvent(event);
                e.stopPropagation();
            });

            this.optionsContainer.appendChild(customOption);
        });
    }

    updateTrigger() {
        const selectedOption = this.originalSelect.options[this.originalSelect.selectedIndex];
        if (!this.trigger) return;

        // Clear content except arrow if it already exists
        let arrow = this.trigger.querySelector('.custom-select-arrow');
        this.trigger.innerHTML = '';

        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';

        const dotColor = selectedOption?.dataset.dot;
        if (dotColor) {
            const dot = document.createElement('div');
            dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0; box-shadow: 0 0 8px ${dotColor}60;`;
            contentWrapper.appendChild(dot);
        }

        const text = document.createElement('span');
        text.textContent = selectedOption ? selectedOption.textContent : 'Seleziona...';
        text.style.fontWeight = '700';
        contentWrapper.appendChild(text);

        this.trigger.appendChild(contentWrapper);
        if (arrow) this.trigger.appendChild(arrow);
    }

    // Public method to re-sync if options changed dynamically
    refresh() {
        this.updateTrigger();
        this.refreshOptions();
    }
}

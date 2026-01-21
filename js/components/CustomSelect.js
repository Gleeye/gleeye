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
        // Initial text
        const selectedOption = this.originalSelect.options[this.originalSelect.selectedIndex];
        this.trigger.innerHTML = `<span>${selectedOption ? selectedOption.textContent : 'Seleziona...'}</span>`;

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
            // Close other open selects
            document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
                if (el !== this.customSelect) el.classList.remove('open');
            });
            this.customSelect.classList.toggle('open');
            e.stopPropagation();
        });

        // Close on click outside
        window.addEventListener('click', (e) => {
            if (!this.customSelect.contains(e.target)) {
                this.customSelect.classList.remove('open');
            }
        });

        // Listen for external changes to original select (e.g. from logic resetting value)
        this.originalSelect.addEventListener('change', () => {
            const selected = this.originalSelect.options[this.originalSelect.selectedIndex];
            this.trigger.querySelector('span').textContent = selected ? selected.textContent : 'Seleziona...';
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
            customOption.textContent = option.textContent;

            if (option.selected) {
                customOption.classList.add('selected');
            }

            customOption.addEventListener('click', (e) => {
                this.originalSelect.value = customOption.dataset.value;
                this.trigger.querySelector('span').textContent = customOption.textContent;

                // Visual update
                this.optionsContainer.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
                customOption.classList.add('selected');

                this.customSelect.classList.remove('open');

                // Trigger change event on original select to fire app logic
                const event = new Event('change', { bubbles: true });
                this.originalSelect.dispatchEvent(event);
                e.stopPropagation();
            });

            this.optionsContainer.appendChild(customOption);
        });
    }

    // Public method to re-sync if options changed dynamically
    refresh() {
        // Update trigger text
        const selected = this.originalSelect.options[this.originalSelect.selectedIndex];
        if (this.trigger && this.trigger.querySelector('span')) {
            this.trigger.querySelector('span').textContent = selected ? selected.textContent : 'Seleziona...';
        }

        // Re-render options
        this.refreshOptions();
    }
}

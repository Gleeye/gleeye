
export const SlashMenu = {
    element: null,
    onSelect: null,
    activeIndex: 0,
    items: [
        { label: 'Text', type: 'paragraph', icon: 'short_text', desc: 'Start writing with plain text.' },
        { label: 'Heading 1', type: 'heading1', icon: 'format_h1', desc: 'Big section heading.' },
        { label: 'Heading 2', type: 'heading2', icon: 'format_h2', desc: 'Medium section heading.' },
        { label: 'Heading 3', type: 'heading3', icon: 'format_h3', desc: 'Small section heading.' },
        { label: 'Bulleted List', type: 'list', icon: 'format_list_bulleted', desc: 'Create a simple bulleted list.' },
        { label: 'Checklist', type: 'checklist', icon: 'check_box', desc: 'Track tasks with a to-do list.' },
        { label: 'Quote', type: 'quote', icon: 'format_quote', desc: 'Capture a quote.' },
        { label: 'Divider', type: 'divider', icon: 'horizontal_rule', desc: 'Visually divide blocks.' },
        { label: 'Code', type: 'code', icon: 'code', desc: 'Capture a code snippet.' },
        { label: 'Table', type: 'table', icon: 'table_chart', desc: 'Add a simple table.' },
        { label: 'Image', type: 'image', icon: 'image', desc: 'Upload or embed with a link.' },
        { label: 'Video', type: 'video', icon: 'movie', desc: 'Embed from YouTube, Vimeo...' },
        { label: 'Audio', type: 'audio', icon: 'headphones', desc: 'Embed an audio player.' },
        { label: 'Embed', type: 'embed', icon: 'code', desc: 'Embed generic content.' },
        { label: 'Link to Page', type: 'link_to_page', icon: 'link', desc: 'Internal link.' }
    ],
    filteredItems: [],

    init() {
        if (this.element) return;
        this.element = document.createElement('div');
        this.element.className = 'slash-menu';
        this.element.style.position = 'fixed';
        this.element.style.zIndex = '9999';
        this.element.style.backgroundColor = 'white';
        this.element.style.borderRadius = '6px';
        this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        this.element.style.border = '1px solid #e2e8f0';
        this.element.style.display = 'none';
        this.element.style.maxHeight = '300px';
        this.element.style.overflowY = 'auto';
        this.element.style.width = '300px';
        this.element.style.textAlign = 'left';

        this.element.onmousedown = (e) => e.preventDefault();

        document.body.appendChild(this.element);
    },

    show(x, y, onSelect) {
        this.init();
        this.onSelect = onSelect;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.display = 'block';
        this.activeIndex = 0;
        this.filteredItems = this.items;
        this.renderItems(this.filteredItems);
    },

    hide() {
        if (this.element) this.element.style.display = 'none';
    },

    filter(query) {
        if (!query) {
            this.filteredItems = this.items;
        } else {
            const q = query.toLowerCase();
            this.filteredItems = this.items.filter(i => i.label.toLowerCase().includes(q));
        }
        this.activeIndex = 0;
        this.renderItems(this.filteredItems);
    },

    navigate(direction) {
        if (this.element.style.display === 'none') return;
        if (direction === 'up') {
            this.activeIndex = Math.max(0, this.activeIndex - 1);
        } else if (direction === 'down') {
            this.activeIndex = Math.min(this.filteredItems.length - 1, this.activeIndex + 1);
        }
        this.renderItems(this.filteredItems);

        const activeEl = this.element.children[this.activeIndex];
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    },

    selectCurrent() {
        if (this.element.style.display === 'none') return false;
        const item = this.filteredItems[this.activeIndex];
        if (item && this.onSelect) {
            this.onSelect(item.type);
            this.hide();
            return true;
        }
        return false;
    },

    renderItems(items) {
        this.element.innerHTML = '';
        if (items.length === 0) {
            this.element.innerHTML = '<div style="padding:12px; color:#94a3b8; font-size:13px;">No matches</div>';
            return;
        }

        items.forEach((item, index) => {
            const div = document.createElement('div');
            // Styles - Use GRID for stability
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.style.display = 'grid';
            div.style.gridTemplateColumns = '24px 1fr';
            div.style.gap = '12px';
            div.style.alignItems = 'center';
            div.style.borderBottom = '1px solid transparent'; // prevent layout shift
            div.style.boxSizing = 'border-box';

            if (index === this.activeIndex) {
                div.style.backgroundColor = '#f1f5f9';
            } else {
                div.style.backgroundColor = 'transparent';
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; height:24px;">
                    <span class="material-icons-round" style="color:#64748b; font-size:20px;">${item.icon}</span>
                </div>
                <div style="display:flex; flex-direction:column; min-width:0;">
                    <span style="font-weight:500; color:#334155; font-size:14px; line-height:1.4;">${item.label}</span>
                    <span style="font-size:12px; color:#94a3b8; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.desc}</span>
                </div>
            `;

            div.onmouseenter = () => {
                this.activeIndex = index;
                Array.from(this.element.children).forEach((child, i) => {
                    child.style.backgroundColor = i === index ? '#f1f5f9' : 'transparent';
                });
            };

            div.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onSelect) {
                    this.onSelect(item.type);
                    this.hide();
                }
            };

            this.element.appendChild(div);
        });
    }
};

export const BlockActionMenu = {
    element: null,
    onAction: null,

    init() {
        if (this.element) return;
        this.element = document.createElement('div');
        this.element.className = 'block-action-menu';
        this.element.style.position = 'fixed';
        this.element.style.zIndex = '9999';
        this.element.style.backgroundColor = 'white';
        this.element.style.borderRadius = '6px';
        this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        this.element.style.border = '1px solid #e2e8f0';
        this.element.style.display = 'none';
        this.element.style.minWidth = '160px';
        this.element.style.padding = '4px 0';
        this.element.style.textAlign = 'left';

        this.element.onmousedown = (e) => e.preventDefault();

        document.body.appendChild(this.element);
    },

    show(x, y, onAction) {
        this.init();
        this.onAction = onAction;
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.display = 'block';
        this.render();
    },

    hide() {
        if (this.element) this.element.style.display = 'none';
    },

    render() {
        const actions = [
            { label: 'Delete', icon: 'delete', action: 'delete', color: '#ef4444' },
            { label: 'Duplicate', icon: 'content_copy', action: 'duplicate' },
            { label: 'Turn into...', icon: 'swap_horiz', action: 'turn_into' },
            { label: 'Insert above', icon: 'vertical_align_top', action: 'insert_above' },
            { label: 'Insert below', icon: 'vertical_align_bottom', action: 'insert_below' },
        ];

        this.element.innerHTML = '';
        actions.forEach(action => {
            const div = document.createElement('div');
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            div.style.fontSize = '14px';
            div.style.color = action.color || '#334155';
            div.style.width = '100%';
            div.style.boxSizing = 'border-box';

            div.innerHTML = `
                <span class="material-icons-round" style="font-size:18px;">${action.icon}</span>
                <span>${action.label}</span>
            `;

            div.onmouseenter = () => div.style.backgroundColor = '#f8fafc';
            div.onmouseleave = () => div.style.backgroundColor = 'transparent';

            div.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.onAction) this.onAction(action.action);
                this.hide();
            };

            this.element.appendChild(div);
        });
    }
};

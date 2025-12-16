/**
 * Rink Selector for Toronto Free Skates
 * Manages rink selection with search, select all/none, and show more/less
 */

const RinkSelector = {
    allRinks: [],
    selectedRinkIds: new Set(),
    searchQuery: '',
    showAll: false,
    urlHasRinks: false,
    INITIAL_DISPLAY_COUNT: 10,

    /**
     * Initialize the rink selector
     */
    init() {
        this.loadSelections();
        this.bindEvents();
    },

    /**
     * Load saved selections from URL params first, then localStorage
     */
    loadSelections() {
        // First check URL params
        const params = new URLSearchParams(window.location.search);
        if (params.has('rinks')) {
            const rinkIds = params.get('rinks').split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (rinkIds.length > 0) {
                this.selectedRinkIds = new Set(rinkIds);
                this.urlHasRinks = true;
                return;
            }
        }

        // Fall back to localStorage
        const stored = localStorage.getItem('skateFinderSelectedRinks');
        if (stored) {
            try {
                const ids = JSON.parse(stored);
                this.selectedRinkIds = new Set(ids);
            } catch {
                this.selectedRinkIds = new Set();
            }
        }
    },

    /**
     * Save selections to localStorage and update URL
     */
    saveSelections() {
        localStorage.setItem('skateFinderSelectedRinks', JSON.stringify([...this.selectedRinkIds]));
        // Update URL via FilterSettings
        if (window.FilterSettings) {
            FilterSettings.updateURL();
        }
    },

    /**
     * Bind UI events
     */
    bindEvents() {
        // Search input
        const searchInput = document.getElementById('rinkSearch');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // Select all button
        document.getElementById('selectAllRinks').addEventListener('click', () => {
            this.selectAll();
        });

        // Select none button
        document.getElementById('selectNoneRinks').addEventListener('click', () => {
            this.selectNone();
        });

        // Show more/less button
        document.getElementById('showMoreRinks').addEventListener('click', () => {
            this.showAll = !this.showAll;
            this.render();
        });
    },

    /**
     * Set the available rinks (called after API loads rinks)
     */
    setRinks(rinks) {
        this.allRinks = rinks.sort((a, b) => a.name.localeCompare(b.name));

        // If URL had rinks param, validate selections against available rinks
        if (this.urlHasRinks) {
            // Filter to only valid rink IDs
            const validIds = new Set(this.allRinks.map(r => r.id));
            const validSelected = [...this.selectedRinkIds].filter(id => validIds.has(id));
            this.selectedRinkIds = new Set(validSelected);
            this.saveSelections();
        }
        // If no selections saved and no URL params, select all by default
        else if (this.selectedRinkIds.size === 0) {
            this.allRinks.forEach(rink => this.selectedRinkIds.add(rink.id));
            this.saveSelections();
        }

        this.render();
    },

    /**
     * Get filtered rinks based on search query
     */
    getFilteredRinks() {
        if (!this.searchQuery) {
            return this.allRinks;
        }
        return this.allRinks.filter(rink =>
            rink.name.toLowerCase().includes(this.searchQuery) ||
            rink.address.toLowerCase().includes(this.searchQuery)
        );
    },

    /**
     * Select all visible rinks
     */
    selectAll() {
        const filtered = this.getFilteredRinks();
        filtered.forEach(rink => this.selectedRinkIds.add(rink.id));
        this.saveSelections();
        this.render();
        this.triggerUpdate();
    },

    /**
     * Deselect all visible rinks
     */
    selectNone() {
        const filtered = this.getFilteredRinks();
        filtered.forEach(rink => this.selectedRinkIds.delete(rink.id));
        this.saveSelections();
        this.render();
        this.triggerUpdate();
    },

    /**
     * Toggle a single rink selection
     */
    toggleRink(rinkId) {
        if (this.selectedRinkIds.has(rinkId)) {
            this.selectedRinkIds.delete(rinkId);
        } else {
            this.selectedRinkIds.add(rinkId);
        }
        this.saveSelections();
        this.updateCount();
        this.triggerUpdate();
    },

    /**
     * Check if a rink is selected
     */
    isSelected(rinkId) {
        return this.selectedRinkIds.has(rinkId);
    },

    /**
     * Get array of selected rink IDs
     */
    getSelectedRinkIds() {
        return [...this.selectedRinkIds];
    },

    /**
     * Update the count display
     */
    updateCount() {
        const countEl = document.getElementById('rinkCount');
        const selectedCount = this.allRinks.filter(r => this.selectedRinkIds.has(r.id)).length;
        countEl.textContent = `${selectedCount} of ${this.allRinks.length}`;
    },

    /**
     * Render the rink list
     */
    render() {
        const listEl = document.getElementById('rinkList');
        const showMoreBtn = document.getElementById('showMoreRinks');

        const filtered = this.getFilteredRinks();

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="no-rinks-match">No rinks match your search</div>';
            showMoreBtn.style.display = 'none';
            this.updateCount();
            return;
        }

        // Determine how many to show
        const displayCount = this.showAll ? filtered.length : Math.min(this.INITIAL_DISPLAY_COUNT, filtered.length);
        const rinksToShow = filtered.slice(0, displayCount);
        const hasMore = filtered.length > this.INITIAL_DISPLAY_COUNT;

        // Build HTML
        listEl.innerHTML = rinksToShow.map(rink => `
            <label class="rink-item" data-rink-id="${rink.id}">
                <input type="checkbox" ${this.isSelected(rink.id) ? 'checked' : ''}>
                <span class="rink-item-name">${rink.name}</span>
                <span class="rink-item-type">${rink.type}</span>
            </label>
        `).join('');

        // Bind checkbox events
        listEl.querySelectorAll('.rink-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const rinkId = parseInt(item.dataset.rinkId, 10);

            item.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleRink(rinkId);
            });
        });

        // Show more/less button
        if (hasMore) {
            showMoreBtn.style.display = 'block';
            showMoreBtn.textContent = this.showAll
                ? `Show less`
                : `Show ${filtered.length - this.INITIAL_DISPLAY_COUNT} more`;
        } else {
            showMoreBtn.style.display = 'none';
        }

        this.updateCount();
    },

    /**
     * Trigger a data refresh in the app
     */
    triggerUpdate() {
        if (window.App) {
            window.App.filterByRinks();
        }
    }
};

/**
 * Filter Settings for Toronto Free Skates
 * Manages filter state with localStorage persistence
 */

const FilterSettings = {
    defaults: {
        maxDistance: 10,
        anyDistance: false,
        timeOfDay: 'all',
        rinkType: '',
        timeFilter: 'upcoming'
    },

    settings: {},

    /**
     * Initialize filter settings from localStorage
     */
    init() {
        const stored = localStorage.getItem('skateFinderFilters');
        if (stored) {
            try {
                this.settings = { ...this.defaults, ...JSON.parse(stored) };
            } catch {
                this.settings = { ...this.defaults };
            }
        } else {
            this.settings = { ...this.defaults };
        }

        this.bindUI();
        this.updateUI();
    },

    /**
     * Bind UI elements to filter settings
     */
    bindUI() {
        // Distance slider
        const distanceSlider = document.getElementById('distanceSlider');
        const distanceValue = document.getElementById('distanceValue');
        const anyDistance = document.getElementById('anyDistance');

        distanceSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            this.settings.maxDistance = value;
            distanceValue.textContent = `${value} km`;
            this.save();
            this.triggerUpdate();
        });

        anyDistance.addEventListener('change', (e) => {
            this.settings.anyDistance = e.target.checked;
            distanceSlider.disabled = e.target.checked;
            this.save();
            this.triggerUpdate();
        });

        // Time of day segments
        document.querySelectorAll('.filters-bar .segmented-control:first-of-type .segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.timeOfDay = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');

                this.save();
                this.triggerUpdate();
            });
        });

        // Rink type segments
        document.getElementById('rinkTypeControl').querySelectorAll('.segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.rinkType = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');

                this.save();
                this.triggerUpdate();
            });
        });

        // Time filter segments (upcoming/all/past)
        document.getElementById('timeFilterControl').querySelectorAll('.segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.timeFilter = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');

                this.save();
                this.triggerUpdate();
            });
        });
    },

    /**
     * Update UI to reflect current settings
     */
    updateUI() {
        // Distance
        const distanceSlider = document.getElementById('distanceSlider');
        const distanceValue = document.getElementById('distanceValue');
        const anyDistance = document.getElementById('anyDistance');

        distanceSlider.value = this.settings.maxDistance;
        distanceValue.textContent = `${this.settings.maxDistance} km`;
        anyDistance.checked = this.settings.anyDistance;
        distanceSlider.disabled = this.settings.anyDistance;

        // Time of day
        document.querySelectorAll('.filters-bar .segmented-control:first-of-type .segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.timeOfDay);
        });

        // Rink type
        document.getElementById('rinkTypeControl').querySelectorAll('.segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.rinkType);
        });

        // Time filter
        document.getElementById('timeFilterControl').querySelectorAll('.segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.timeFilter);
        });
    },

    /**
     * Save settings to localStorage
     */
    save() {
        localStorage.setItem('skateFinderFilters', JSON.stringify(this.settings));
    },

    /**
     * Get current filter settings for API
     */
    getFilters() {
        return {
            maxDistance: this.settings.maxDistance,
            anyDistance: this.settings.anyDistance,
            timeOfDay: this.settings.timeOfDay,
            rinkType: this.settings.rinkType,
            timeFilter: this.settings.timeFilter
        };
    },

    /**
     * Trigger a data refresh
     */
    triggerUpdate() {
        if (window.App) {
            window.App.loadSessions();
        }
    },

    /**
     * Check if any filters are active (non-default)
     */
    hasActiveFilters() {
        return (
            this.settings.maxDistance !== this.defaults.maxDistance ||
            this.settings.anyDistance !== this.defaults.anyDistance ||
            this.settings.timeOfDay !== this.defaults.timeOfDay ||
            this.settings.rinkType !== this.defaults.rinkType ||
            this.settings.timeFilter !== this.defaults.timeFilter
        );
    }
};

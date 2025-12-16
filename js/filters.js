/**
 * Filter Settings for Toronto Free Skates
 * Manages filter state with URL params and localStorage persistence
 */

const FilterSettings = {
    defaults: {
        maxDistance: 10,
        anyDistance: true,
        dateFilter: 'any',
        selectedDate: null,
        timeOfDay: 'all',
        rinkType: '',
        timeFilter: 'upcoming'
    },

    settings: {},

    /**
     * Initialize filter settings - URL params take priority, then localStorage
     */
    init() {
        // First try URL params
        const urlSettings = this.readFromURL();

        if (urlSettings) {
            this.settings = { ...this.defaults, ...urlSettings };
        } else {
            // Fall back to localStorage
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
        }

        this.bindUI();
        this.updateUI();
    },

    /**
     * Read filter settings from URL params
     */
    readFromURL() {
        const params = new URLSearchParams(window.location.search);

        // Check if any filter params exist
        const hasParams = params.has('dist') || params.has('anyDist') ||
                         params.has('date') || params.has('pickDate') ||
                         params.has('time') || params.has('type') ||
                         params.has('show') || params.has('rinks');

        if (!hasParams) return null;

        const settings = {};

        // Distance
        if (params.has('dist')) {
            const dist = parseInt(params.get('dist'), 10);
            if (!isNaN(dist) && dist >= 1 && dist <= 50) {
                settings.maxDistance = dist;
            }
        }

        // Any distance
        if (params.has('anyDist')) {
            settings.anyDistance = params.get('anyDist') === '1';
        }

        // Date filter
        if (params.has('date')) {
            const dateVal = params.get('date');
            if (['any', 'today', 'tomorrow', 'pick'].includes(dateVal)) {
                settings.dateFilter = dateVal;
            }
        }

        // Selected date (for pick mode)
        if (params.has('pickDate')) {
            settings.selectedDate = params.get('pickDate');
        }

        // Time of day
        if (params.has('time')) {
            const timeVal = params.get('time');
            if (['all', 'morning', 'afternoon', 'evening'].includes(timeVal)) {
                settings.timeOfDay = timeVal;
            }
        }

        // Rink type
        if (params.has('type')) {
            const typeVal = params.get('type');
            if (['', 'Indoor', 'Outdoor'].includes(typeVal)) {
                settings.rinkType = typeVal;
            }
        }

        // Session filter (upcoming/all/past)
        if (params.has('show')) {
            const showVal = params.get('show');
            if (['upcoming', 'all', 'past'].includes(showVal)) {
                settings.timeFilter = showVal;
            }
        }

        return settings;
    },

    /**
     * Update URL with current filter settings
     */
    updateURL() {
        const params = new URLSearchParams();

        // Only add non-default values to keep URL clean
        if (this.settings.maxDistance !== this.defaults.maxDistance) {
            params.set('dist', this.settings.maxDistance);
        }
        if (this.settings.anyDistance !== this.defaults.anyDistance) {
            params.set('anyDist', this.settings.anyDistance ? '1' : '0');
        }
        if (this.settings.dateFilter !== this.defaults.dateFilter) {
            params.set('date', this.settings.dateFilter);
        }
        if (this.settings.selectedDate) {
            params.set('pickDate', this.settings.selectedDate);
        }
        if (this.settings.timeOfDay !== this.defaults.timeOfDay) {
            params.set('time', this.settings.timeOfDay);
        }
        if (this.settings.rinkType !== this.defaults.rinkType) {
            params.set('type', this.settings.rinkType);
        }
        if (this.settings.timeFilter !== this.defaults.timeFilter) {
            params.set('show', this.settings.timeFilter);
        }

        // Add rink selections if not all selected
        if (window.RinkSelector) {
            const selectedIds = RinkSelector.getSelectedRinkIds();
            const allIds = RinkSelector.allRinks.map(r => r.id);

            // Only add to URL if not all rinks are selected
            if (selectedIds.length > 0 && selectedIds.length < allIds.length) {
                params.set('rinks', selectedIds.join(','));
            }
        }

        // Update URL without reload
        const newURL = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newURL);
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

        // Date filter buttons
        const datePickerContainer = document.getElementById('datePickerContainer');
        const datePicker = document.getElementById('datePicker');

        document.getElementById('dateFilterControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.dateFilter = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Show/hide date picker
                if (value === 'pick') {
                    datePickerContainer.style.display = 'block';
                    // Set to today if no date selected
                    if (!this.settings.selectedDate) {
                        const today = new Date();
                        this.settings.selectedDate = this.formatDate(today);
                        datePicker.value = this.settings.selectedDate;
                    }
                } else {
                    datePickerContainer.style.display = 'none';
                    this.settings.selectedDate = null;
                }

                this.save();
                this.triggerUpdate();
            });
        });

        datePicker.addEventListener('change', (e) => {
            this.settings.selectedDate = e.target.value;
            this.save();
            this.triggerUpdate();
        });

        // Time of day filter buttons
        document.getElementById('timeOfDayControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.timeOfDay = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.save();
                this.triggerUpdate();
            });
        });

        // Rink type filter buttons
        document.getElementById('rinkTypeControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.rinkType = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.save();
                this.triggerUpdate();
            });
        });

        // Time filter buttons (upcoming/all/past)
        document.getElementById('timeFilterControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.settings.timeFilter = value;

                // Update active state
                e.target.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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

        // Date filter
        const datePickerContainer = document.getElementById('datePickerContainer');
        const datePicker = document.getElementById('datePicker');

        document.getElementById('dateFilterControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.dateFilter);
        });

        if (this.settings.dateFilter === 'pick') {
            datePickerContainer.style.display = 'block';
            if (this.settings.selectedDate) {
                datePicker.value = this.settings.selectedDate;
            }
        } else {
            datePickerContainer.style.display = 'none';
        }

        // Time of day
        document.getElementById('timeOfDayControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.timeOfDay);
        });

        // Rink type
        document.getElementById('rinkTypeControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.rinkType);
        });

        // Time filter
        document.getElementById('timeFilterControl').querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === this.settings.timeFilter);
        });
    },

    /**
     * Save settings to localStorage and update URL
     */
    save() {
        localStorage.setItem('skateFinderFilters', JSON.stringify(this.settings));
        this.updateURL();
    },

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get the date string for filtering based on current settings
     */
    getFilterDate() {
        if (this.settings.dateFilter === 'any') {
            return null;
        }
        if (this.settings.dateFilter === 'today') {
            return this.formatDate(new Date());
        }
        if (this.settings.dateFilter === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return this.formatDate(tomorrow);
        }
        if (this.settings.dateFilter === 'pick' && this.settings.selectedDate) {
            return this.settings.selectedDate;
        }
        return null;
    },

    /**
     * Get current filter settings for API
     */
    getFilters() {
        return {
            maxDistance: this.settings.maxDistance,
            anyDistance: this.settings.anyDistance,
            dateFilter: this.settings.dateFilter,
            filterDate: this.getFilterDate(),
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
            this.settings.dateFilter !== this.defaults.dateFilter ||
            this.settings.timeOfDay !== this.defaults.timeOfDay ||
            this.settings.rinkType !== this.defaults.rinkType ||
            this.settings.timeFilter !== this.defaults.timeFilter
        );
    }
};

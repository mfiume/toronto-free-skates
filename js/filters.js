/**
 * Filter Settings for Toronto Free Skates
 * Manages filter state with localStorage persistence
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
     * Save settings to localStorage
     */
    save() {
        localStorage.setItem('skateFinderFilters', JSON.stringify(this.settings));
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

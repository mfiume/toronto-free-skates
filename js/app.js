/**
 * Main Application for Toronto Free Skates
 */

const App = {
    sessions: [],
    rinks: [],
    selectedDate: new Date(),
    isLoading: false,

    /**
     * Initialize the application
     */
    async init() {
        console.log('Toronto Free Skates - Initializing...');

        // Initialize modules
        await LocationManager.init();
        FilterSettings.init();
        Views.initTabs();

        // Bind UI events
        this.bindEvents();

        // Load initial data
        await this.loadSessions();

        console.log('Toronto Free Skates - Ready!');
    },

    /**
     * Bind UI events
     */
    bindEvents() {
        // Calendar navigation
        document.getElementById('prevDay').addEventListener('click', () => {
            this.selectedDate.setDate(this.selectedDate.getDate() - 1);
            this.updateCalendarView();
        });

        document.getElementById('nextDay').addEventListener('click', () => {
            this.selectedDate.setDate(this.selectedDate.getDate() + 1);
            this.updateCalendarView();
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.selectedDate = new Date();
            this.updateCalendarView();
        });

        // Date picker
        const datePicker = document.getElementById('datePicker');
        const datePickerBtn = document.getElementById('datePickerBtn');

        datePickerBtn.addEventListener('click', () => {
            datePicker.showPicker();
        });

        datePicker.addEventListener('change', (e) => {
            const [year, month, day] = e.target.value.split('-').map(Number);
            this.selectedDate = new Date(year, month - 1, day);
            this.updateCalendarView();
        });

        // Calendar sort
        document.getElementById('calendarSort').addEventListener('change', (e) => {
            this.updateCalendarView();
        });

        // Calendar search
        document.getElementById('calendarSearch').addEventListener('input', () => {
            this.updateCalendarView();
        });

        // List sort
        document.getElementById('listSort').addEventListener('change', () => {
            this.updateListView();
        });

        // List search
        document.getElementById('listSearch').addEventListener('input', () => {
            this.updateListView();
        });

        // Swipe gestures for calendar (touch devices)
        let touchStartX = 0;
        const calendarView = document.getElementById('calendarView');

        calendarView.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        calendarView.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    // Swipe left - next day
                    this.selectedDate.setDate(this.selectedDate.getDate() + 1);
                } else {
                    // Swipe right - prev day
                    this.selectedDate.setDate(this.selectedDate.getDate() - 1);
                }
                this.updateCalendarView();
            }
        }, { passive: true });
    },

    /**
     * Load sessions from API
     */
    async loadSessions() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading(true);

        try {
            const userLocation = LocationManager.getLocation();
            const filters = FilterSettings.getFilters();

            console.log('Loading sessions with filters:', filters);
            console.log('User location:', userLocation);

            const { sessions, rinks } = await API.fetchAllSessions(userLocation, filters);

            this.sessions = sessions;
            this.rinks = rinks;

            console.log(`Loaded ${sessions.length} sessions from ${rinks.length} rinks`);

            // Update all views
            this.updateAllViews();
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showError('Failed to load skating sessions. Please try again.');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    },

    /**
     * Update all views
     */
    updateAllViews() {
        this.updateCalendarView();
        this.updateListView();
        this.updateMapView();
        this.updateEmptyState();
    },

    /**
     * Update calendar view
     */
    updateCalendarView() {
        const sortBy = document.getElementById('calendarSort').value;
        const searchQuery = document.getElementById('calendarSearch').value;

        // Update date picker value
        document.getElementById('datePicker').value = API.formatDate(this.selectedDate);

        Views.renderCalendarView(this.sessions, this.selectedDate, sortBy, searchQuery);
    },

    /**
     * Update list view
     */
    updateListView() {
        const sortBy = document.getElementById('listSort').value;
        const searchQuery = document.getElementById('listSearch').value;

        Views.renderListView(this.sessions, sortBy, searchQuery);
    },

    /**
     * Update map view
     */
    updateMapView() {
        Views.renderMapView(this.sessions, this.rinks);
    },

    /**
     * Update empty state visibility
     */
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const calendarSessions = document.getElementById('calendarSessions');
        const listSessions = document.getElementById('listSessions');

        if (this.sessions.length === 0 && !this.isLoading) {
            emptyState.style.display = 'block';

            // Update empty message based on filters
            const message = document.getElementById('emptyMessage');
            if (FilterSettings.hasActiveFilters()) {
                message.textContent = 'Try adjusting your filters or expanding your search distance.';
            } else {
                message.textContent = 'No skating sessions available at this time.';
            }
        } else {
            emptyState.style.display = 'none';
        }
    },

    /**
     * Show/hide loading indicator
     */
    showLoading(show) {
        const loading = document.getElementById('loadingIndicator');
        const calendarView = document.getElementById('calendarView');
        const listView = document.getElementById('listView');

        if (show) {
            loading.style.display = 'flex';
            document.getElementById('calendarSessions').innerHTML = '';
            document.getElementById('listSessions').innerHTML = '';
        } else {
            loading.style.display = 'none';
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        LocationManager.showToast(message);
    }
};

// Make App globally available
window.App = App;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

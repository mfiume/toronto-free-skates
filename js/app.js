/**
 * Main Application for Toronto Free Skates
 */

const App = {
    sessions: [],
    rinks: [],
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
        // Mobile filter toggle
        const filterToggle = document.getElementById('filterToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarClose = document.getElementById('sidebarClose');

        filterToggle.addEventListener('click', () => {
            sidebar.classList.add('open');
            document.body.classList.add('sidebar-open');
        });

        sidebarClose.addEventListener('click', () => {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        });

        // List sort buttons
        document.querySelectorAll('#listSort .sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#listSort .sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateListView();
            });
        });

        // List search
        document.getElementById('listSearch').addEventListener('input', () => {
            this.updateListView();
        });
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
        this.updateListView();
        this.updateMapView();
        this.updateEmptyState();
    },

    /**
     * Update list view
     */
    updateListView() {
        const activeBtn = document.querySelector('#listSort .sort-btn.active');
        const sortBy = activeBtn ? activeBtn.dataset.value : 'time';
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

        if (show) {
            loading.style.display = 'flex';
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

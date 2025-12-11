/**
 * Location Manager for Toronto Free Skates
 * Handles browser geolocation and address geocoding with autocomplete
 */

const LocationManager = {
    userLocation: null,
    locationMode: 'auto', // 'auto' or 'manual'
    geocodeCache: new Map(),

    /**
     * Initialize location services
     */
    async init() {
        const statusEl = document.getElementById('locationStatus');
        const textEl = document.getElementById('locationText');
        const addressContainer = document.getElementById('addressContainer');
        const useAddressBtn = document.getElementById('useAddressBtn');
        const addressInput = document.getElementById('addressInput');
        const suggestionsEl = document.getElementById('addressSuggestions');

        // Try to get browser location
        if ('geolocation' in navigator) {
            try {
                const position = await this.getCurrentPosition();
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.locationMode = 'auto';
                textEl.textContent = `Using your location`;
                useAddressBtn.textContent = 'Use Address Instead';

                // Reverse geocode to show address
                this.reverseGeocode(this.userLocation.lat, this.userLocation.lng)
                    .then(address => {
                        if (address) {
                            textEl.textContent = address;
                        }
                    });

            } catch (error) {
                console.log('Geolocation unavailable:', error.message);
                this.showAddressInput();
            }
        } else {
            this.showAddressInput();
        }

        // Toggle address input
        useAddressBtn.addEventListener('click', () => {
            if (this.locationMode === 'auto') {
                this.showAddressInput();
            } else {
                this.tryAutoLocation();
            }
        });

        // Address input with autocomplete
        let debounceTimer;
        addressInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length < 3) {
                suggestionsEl.classList.remove('active');
                return;
            }

            debounceTimer = setTimeout(() => {
                this.searchAddresses(query);
            }, 300);
        });

        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!addressContainer.contains(e.target)) {
                suggestionsEl.classList.remove('active');
            }
        });

        // Handle Enter key
        addressInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const firstSuggestion = suggestionsEl.querySelector('.suggestion-item');
                if (firstSuggestion) {
                    firstSuggestion.click();
                }
            }
        });
    },

    /**
     * Get current position as a Promise
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes cache
            });
        });
    },

    /**
     * Show address input and hide auto-location
     */
    showAddressInput() {
        const textEl = document.getElementById('locationText');
        const addressContainer = document.getElementById('addressContainer');
        const useAddressBtn = document.getElementById('useAddressBtn');
        const statusEl = document.getElementById('locationStatus');

        this.locationMode = 'manual';
        statusEl.style.display = 'none';
        addressContainer.style.display = 'block';
        useAddressBtn.textContent = 'Use My Location';
    },

    /**
     * Try to get auto location again
     */
    async tryAutoLocation() {
        const textEl = document.getElementById('locationText');
        const addressContainer = document.getElementById('addressContainer');
        const useAddressBtn = document.getElementById('useAddressBtn');
        const statusEl = document.getElementById('locationStatus');

        textEl.textContent = 'Detecting location...';
        statusEl.style.display = 'flex';
        addressContainer.style.display = 'none';

        try {
            const position = await this.getCurrentPosition();
            this.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            this.locationMode = 'auto';
            textEl.textContent = `Using your location`;
            useAddressBtn.textContent = 'Use Address Instead';

            // Reverse geocode
            this.reverseGeocode(this.userLocation.lat, this.userLocation.lng)
                .then(address => {
                    if (address) {
                        textEl.textContent = `📍 ${address}`;
                    }
                });

            // Trigger refresh
            if (window.App) {
                window.App.loadSessions();
            }
        } catch (error) {
            this.showAddressInput();
        }
    },

    /**
     * Search for addresses using Nominatim (OpenStreetMap)
     */
    async searchAddresses(query) {
        const suggestionsEl = document.getElementById('addressSuggestions');

        // Add Toronto, Canada context for better results
        const searchQuery = query.includes('Toronto') || query.includes('ON') || query.includes('Ontario')
            ? query
            : `${query}, Toronto, ON, Canada`;

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1&countrycodes=ca`,
                {
                    headers: {
                        'Accept-Language': 'en'
                    }
                }
            );

            const results = await response.json();

            if (results.length === 0) {
                suggestionsEl.innerHTML = '<div class="suggestion-item"><span class="main-text">No results found</span></div>';
                suggestionsEl.classList.add('active');
                return;
            }

            suggestionsEl.innerHTML = results.map(result => {
                const mainText = result.address.road || result.address.neighbourhood || result.display_name.split(',')[0];
                const subText = [
                    result.address.city || result.address.town || result.address.municipality,
                    result.address.state || result.address.province,
                    result.address.postcode
                ].filter(Boolean).join(', ');

                return `
                    <div class="suggestion-item"
                         data-lat="${result.lat}"
                         data-lng="${result.lon}"
                         data-address="${result.display_name}">
                        <div class="main-text">${mainText}</div>
                        <div class="sub-text">${subText}</div>
                    </div>
                `;
            }).join('');

            // Add click handlers
            suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => this.selectAddress(item));
            });

            suggestionsEl.classList.add('active');
        } catch (error) {
            console.error('Address search error:', error);
        }
    },

    /**
     * Select an address from suggestions
     */
    selectAddress(item) {
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        const address = item.dataset.address;

        const addressInput = document.getElementById('addressInput');
        const suggestionsEl = document.getElementById('addressSuggestions');

        this.userLocation = { lat, lng };
        addressInput.value = item.querySelector('.main-text').textContent;
        suggestionsEl.classList.remove('active');

        // Show toast
        this.showToast(`Location set to ${item.querySelector('.main-text').textContent}`);

        // Trigger refresh
        if (window.App) {
            window.App.loadSessions();
        }
    },

    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(lat, lng) {
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?` +
                `format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'en'
                    }
                }
            );

            const result = await response.json();

            if (result.address) {
                const parts = [];
                if (result.address.road) parts.push(result.address.road);
                if (result.address.neighbourhood) parts.push(result.address.neighbourhood);
                if (result.address.city || result.address.town) {
                    parts.push(result.address.city || result.address.town);
                }

                const address = parts.slice(0, 2).join(', ');
                this.geocodeCache.set(cacheKey, address);
                return address;
            }

            return null;
        } catch (error) {
            console.error('Reverse geocode error:', error);
            return null;
        }
    },

    /**
     * Get user location or null if not available
     */
    getLocation() {
        return this.userLocation;
    },

    /**
     * Check if location is available
     */
    hasLocation() {
        return this.userLocation !== null;
    },

    /**
     * Show toast notification
     */
    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }
};

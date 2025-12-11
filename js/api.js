/**
 * API Service for Toronto Free Skates
 * Fetches rink locations and skating schedules from Toronto Open Data
 */

const API = {
    // ArcGIS FeatureServer for rink locations
    RINKS_URL: 'https://services3.arcgis.com/b9WvedVPoizGfvfD/arcgis/rest/services/Skate_Locations_v2/FeatureServer/0/query',

    // Toronto Open Data for schedule data
    SCHEDULE_URL: 'https://www.toronto.ca/data/parks/live/dropin/skate',

    // Cache for rinks data
    rinksCache: null,

    /**
     * Fetch all rink locations from ArcGIS
     */
    async fetchRinks() {
        if (this.rinksCache) {
            return this.rinksCache;
        }

        const params = new URLSearchParams({
            where: '1=1',
            outFields: 'locationid,location,address,location_type,x,y',
            f: 'json',
            returnGeometry: 'false'
        });

        try {
            const response = await fetch(`${this.RINKS_URL}?${params}`);
            const data = await response.json();

            this.rinksCache = data.features.map(feature => ({
                id: feature.attributes.locationid,
                name: feature.attributes.location,
                address: feature.attributes.address,
                type: feature.attributes.location_type,
                lat: feature.attributes.y,
                lng: feature.attributes.x
            }));

            return this.rinksCache;
        } catch (error) {
            console.error('Error fetching rinks:', error);
            return [];
        }
    },

    /**
     * Fetch schedule for a specific rink
     * Toronto's API returns UTF-16 encoded data, which we handle via proxy or text parsing
     */
    async fetchSchedule(rinkId) {
        const url = `${this.SCHEDULE_URL}/${rinkId}.json`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                return [];
            }

            // Get as array buffer to handle encoding
            const buffer = await response.arrayBuffer();

            // Try to decode as UTF-16LE (Toronto's encoding)
            let text;
            try {
                const decoder = new TextDecoder('utf-16le');
                text = decoder.decode(buffer);
            } catch {
                // Fallback to UTF-8
                const decoder = new TextDecoder('utf-8');
                text = decoder.decode(buffer);
            }

            // Remove BOM if present
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }

            // Parse JSON
            const data = JSON.parse(text);

            // Extract sessions - Toronto's format: Array of objects with 'r' array
            const sessions = [];

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.r && Array.isArray(item.r)) {
                        for (const session of item.r) {
                            // Only include leisure skating (lowercase comparison)
                            const activity = (session.c || '').toLowerCase();
                            if (activity.includes('leisure skate') || activity.includes('leisure ice')) {
                                sessions.push({
                                    activity: session.c,
                                    date: session.d,      // YYYY-MM-DD
                                    time: session.t,      // HH:MM AM/PM
                                    age: session.age || 'All Ages',
                                    facility: session.f
                                });
                            }
                        }
                    }
                }
            }

            return sessions;
        } catch (error) {
            // Silent fail for individual rinks
            return [];
        }
    },

    /**
     * Fetch all sessions from all rinks
     */
    async fetchAllSessions(userLocation = null, filters = {}) {
        const rinks = await this.fetchRinks();

        if (rinks.length === 0) {
            return { sessions: [], rinks: [] };
        }

        // Filter rinks by distance if user location is available
        let filteredRinks = rinks;
        if (userLocation && !filters.anyDistance) {
            const maxDistance = filters.maxDistance || 10;
            filteredRinks = rinks.filter(rink => {
                const distance = this.calculateDistance(
                    userLocation.lat, userLocation.lng,
                    rink.lat, rink.lng
                );
                rink.distance = distance;
                return distance <= maxDistance;
            });
        } else if (userLocation) {
            // Calculate distance for all rinks even if not filtering
            filteredRinks = rinks.map(rink => ({
                ...rink,
                distance: this.calculateDistance(
                    userLocation.lat, userLocation.lng,
                    rink.lat, rink.lng
                )
            }));
        }

        // Filter by rink type
        if (filters.rinkType) {
            filteredRinks = filteredRinks.filter(rink => rink.type === filters.rinkType);
        }

        // Fetch schedules in parallel
        const schedulePromises = filteredRinks.map(async rink => {
            const schedule = await this.fetchSchedule(rink.id);
            return schedule.map(session => ({
                rink: {
                    id: rink.id,
                    name: rink.name,
                    address: rink.address,
                    type: rink.type,
                    lat: rink.lat,
                    lng: rink.lng,
                    distance: rink.distance
                },
                session
            }));
        });

        // Wait for all with timeout
        const results = await Promise.allSettled(
            schedulePromises.map(p =>
                Promise.race([
                    p,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 30000)
                    )
                ])
            )
        );

        // Flatten results
        let sessions = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                sessions.push(...result.value);
            }
        }

        // Apply time filters
        sessions = this.applyTimeFilters(sessions, filters);

        // Sort by date and time
        sessions.sort((a, b) => {
            const dateCompare = a.session.date.localeCompare(b.session.date);
            if (dateCompare !== 0) return dateCompare;
            return this.parseTime(a.session.time) - this.parseTime(b.session.time);
        });

        return { sessions, rinks: filteredRinks };
    },

    /**
     * Apply time-based filters to sessions
     */
    applyTimeFilters(sessions, filters) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = this.formatDate(today);

        return sessions.filter(item => {
            const { session } = item;

            // Time of day filter
            if (filters.timeOfDay && filters.timeOfDay !== 'all') {
                const hour = this.parseTime(session.time);
                if (filters.timeOfDay === 'morning' && (hour < 0 || hour >= 12)) return false;
                if (filters.timeOfDay === 'afternoon' && (hour < 12 || hour >= 17)) return false;
                if (filters.timeOfDay === 'evening' && (hour < 17 || hour >= 24)) return false;
            }

            // Upcoming/past filter
            if (filters.timeFilter && filters.timeFilter !== 'all') {
                if (filters.timeFilter === 'upcoming' && session.date < todayStr) return false;
                if (filters.timeFilter === 'past' && session.date >= todayStr) return false;
            }

            return true;
        });
    },

    /**
     * Parse time string to hours (24h format)
     */
    parseTime(timeStr) {
        if (!timeStr) return 0;

        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (!match) return 0;

        let hours = parseInt(match[1], 10);
        const isPM = match[3] && match[3].toUpperCase() === 'PM';
        const isAM = match[3] && match[3].toUpperCase() === 'AM';

        if (isPM && hours !== 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        return hours;
    },

    /**
     * Calculate distance between two coordinates using Haversine formula
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRad(deg) {
        return deg * (Math.PI / 180);
    },

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

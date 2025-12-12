/**
 * Views for Toronto Free Skates
 * Handles list and map view rendering
 */

const Views = {
    map: null,
    markers: [],
    userMarker: null,

    /**
     * Initialize view tabs
     */
    initTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const viewName = tab.dataset.view;
                this.switchView(viewName);
            });
        });
    },

    /**
     * Switch to a view
     */
    switchView(viewName) {
        // Update tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewName}View`).classList.add('active');

        // Initialize map on first view
        if (viewName === 'map' && !this.map) {
            this.initMap();
        }

        // Invalidate map size and re-render when switching to map
        if (viewName === 'map' && this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
                // Re-render markers with current data
                if (window.App && window.App.sessions) {
                    this.renderMapView(window.App.sessions, window.App.rinks);
                }
            }, 100);
        }
    },

    /**
     * Initialize Leaflet map
     */
    initMap() {
        // Default to Toronto city center
        this.map = L.map('map').setView([43.6532, -79.3832], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    },

    /**
     * Render sessions in list view
     */
    renderListView(sessions, sortBy = 'time', searchQuery = '') {
        const container = document.getElementById('listSessions');

        let filtered = sessions;

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.rink.name.toLowerCase().includes(query) ||
                item.rink.address.toLowerCase().includes(query)
            );
        }

        // Sort
        filtered = this.sortSessions(filtered, sortBy);

        // Group by date
        const grouped = this.groupByDate(filtered);

        if (Object.keys(grouped).length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No skating sessions found</h3>
                    <p>Try adjusting your filters or expanding your search distance.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = Object.entries(grouped).map(([date, items]) => `
            <div class="date-group">
                <div class="date-group-header">${this.formatDateHeader(date)}</div>
                ${items.map(item => this.renderSessionCard(item, false)).join('')}
            </div>
        `).join('');
    },

    /**
     * Render map view
     */
    renderMapView(sessions, rinks) {
        if (!this.map) return;

        // Clear existing markers
        this.markers.forEach(m => m.remove());
        this.markers = [];

        // Group sessions by rink
        const rinkSessions = new Map();
        sessions.forEach(item => {
            const key = item.rink.id;
            if (!rinkSessions.has(key)) {
                rinkSessions.set(key, { rink: item.rink, sessions: [] });
            }
            rinkSessions.get(key).sessions.push(item.session);
        });

        // Add markers for each rink
        const bounds = [];
        rinkSessions.forEach(({ rink, sessions: rinkSessionList }) => {
            const isIndoor = rink.type === 'Indoor';
            const markerHtml = `
                <div class="custom-marker ${isIndoor ? 'indoor' : 'outdoor'}">
                    ${rinkSessionList.length}
                </div>
            `;

            const icon = L.divIcon({
                html: markerHtml,
                className: 'custom-marker-container',
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            const marker = L.marker([rink.lat, rink.lng], { icon })
                .addTo(this.map)
                .on('click', () => this.showRinkSidebar(rink, rinkSessionList));

            this.markers.push(marker);
            bounds.push([rink.lat, rink.lng]);
        });

        // Add user location marker
        const userLocation = LocationManager.getLocation();
        if (userLocation) {
            if (this.userMarker) {
                this.userMarker.remove();
            }

            const userIcon = L.divIcon({
                html: '<div class="user-marker"></div>',
                className: 'user-marker-container',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            this.userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                .addTo(this.map);

            bounds.push([userLocation.lat, userLocation.lng]);
        }

        // Fit bounds
        if (bounds.length > 0) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Clear sidebar
        document.getElementById('mapSidebarTitle').textContent = 'Select a rink';
        document.getElementById('mapSidebarContent').innerHTML = `
            <p style="color: var(--text-secondary);">
                Click on a marker to see skating sessions at that location.
            </p>
        `;
    },

    /**
     * Show rink details in sidebar
     */
    showRinkSidebar(rink, sessions) {
        const titleEl = document.getElementById('mapSidebarTitle');
        const contentEl = document.getElementById('mapSidebarContent');

        titleEl.textContent = rink.name;

        const distanceHtml = rink.distance !== undefined
            ? `<span class="session-distance">${rink.distance.toFixed(1)} km away</span>`
            : '';

        contentEl.innerHTML = `
            <div style="margin-bottom: 16px;">
                <p style="color: var(--text-secondary); margin-bottom: 4px;">${rink.address}</p>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="badge ${rink.type === 'Indoor' ? 'badge-indoor' : 'badge-outdoor'}">
                        ${rink.type}
                    </span>
                    ${distanceHtml}
                </div>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button class="btn btn-secondary" onclick="Views.openInMaps(${rink.lat}, ${rink.lng})">
                    🗺️ Directions
                </button>
            </div>
            <h4 style="margin-bottom: 12px;">Upcoming Sessions</h4>
            ${sessions.slice(0, 10).map(session => `
                <div style="padding: 12px; background: var(--gray-100); border-radius: 8px; margin-bottom: 8px;">
                    <div style="font-weight: 600;">${this.formatDateHeader(session.date)}</div>
                    <div style="color: var(--primary-color); font-weight: 600;">${session.time}</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">${session.age}</div>
                </div>
            `).join('')}
            ${sessions.length > 10 ? `<p style="color: var(--text-secondary);">+ ${sessions.length - 10} more sessions</p>` : ''}
        `;
    },

    /**
     * Open location in maps
     */
    openInMaps(lat, lng) {
        const userLocation = LocationManager.getLocation();
        let url;
        if (userLocation) {
            url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}`;
        } else {
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        }
        window.open(url, '_blank');
    },

    /**
     * Render a session card
     */
    renderSessionCard(item, showDate = true) {
        const { rink, session } = item;
        const isIndoor = rink.type === 'Indoor';

        const distanceHtml = rink.distance !== undefined
            ? `<span class="session-distance">${rink.distance.toFixed(1)} km</span>`
            : '';

        const dateHtml = showDate
            ? `<div class="date">${this.formatDateShort(session.date)}</div>`
            : '';

        return `
            <div class="session-card" onclick="Views.openInMaps(${rink.lat}, ${rink.lng})">
                <div class="session-time">
                    <div class="time">${session.time}</div>
                    ${dateHtml}
                </div>
                <div class="session-info">
                    <h3>${rink.name}</h3>
                    <p class="address">${rink.address}</p>
                    <div class="session-meta">
                        <span class="badge ${isIndoor ? 'badge-indoor' : 'badge-outdoor'}">
                            ${rink.type}
                        </span>
                        <span class="badge badge-age">${session.age}</span>
                        ${distanceHtml}
                    </div>
                </div>
                <div class="session-actions">
                    <a class="action-link" href="#" onclick="event.preventDefault(); event.stopPropagation(); Views.openInMaps(${rink.lat}, ${rink.lng})">Map</a>
                    <a class="action-link" href="#" onclick="event.preventDefault(); event.stopPropagation(); Views.addToCalendar('${rink.name.replace(/'/g, "\\'")}', '${rink.address.replace(/'/g, "\\'")}', '${session.date}', '${session.time}', '${session.age}')">Cal</a>
                </div>
            </div>
        `;
    },

    /**
     * Add session to calendar (download ICS file)
     */
    addToCalendar(name, address, date, time, age) {
        const startDate = this.parseDateTime(date, time);
        if (!startDate) {
            alert('Unable to parse date/time');
            return;
        }

        const endDate = new Date(startDate.getTime() + 90 * 60000); // 1.5 hours default

        const formatICSDate = (d) => {
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Toronto Free Skates//EN
BEGIN:VEVENT
UID:${Date.now()}@torontofreeskates
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${name} - Leisure Skating
LOCATION:${address}
DESCRIPTION:Leisure skating session\\n${age}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skating-${date}.ics`;
        a.click();
        URL.revokeObjectURL(url);

        LocationManager.showToast('Calendar event downloaded');
    },

    /**
     * Parse date and time strings to Date object
     */
    parseDateTime(dateStr, timeStr) {
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

            if (!timeMatch) return null;

            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const isPM = timeMatch[3] && timeMatch[3].toUpperCase() === 'PM';
            const isAM = timeMatch[3] && timeMatch[3].toUpperCase() === 'AM';

            if (isPM && hours !== 12) hours += 12;
            if (isAM && hours === 12) hours = 0;

            return new Date(year, month - 1, day, hours, minutes);
        } catch {
            return null;
        }
    },

    /**
     * Sort sessions
     */
    sortSessions(sessions, sortBy) {
        const sorted = [...sessions];

        switch (sortBy) {
            case 'name':
                sorted.sort((a, b) => a.rink.name.localeCompare(b.rink.name));
                break;
            case 'distance':
                sorted.sort((a, b) => {
                    const distA = a.rink.distance ?? Infinity;
                    const distB = b.rink.distance ?? Infinity;
                    return distA - distB;
                });
                break;
            case 'time':
            default:
                sorted.sort((a, b) => {
                    const dateCompare = a.session.date.localeCompare(b.session.date);
                    if (dateCompare !== 0) return dateCompare;
                    return API.parseTime(a.session.time) - API.parseTime(b.session.time);
                });
        }

        return sorted;
    },

    /**
     * Group sessions by date
     */
    groupByDate(sessions) {
        const groups = {};
        sessions.forEach(item => {
            const date = item.session.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(item);
        });
        return groups;
    },

    /**
     * Format date for header (e.g., "Monday, December 11")
     */
    formatDateHeader(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.getTime() === today.getTime()) return 'Today';
        if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Format date short (e.g., "Mon 11")
     */
    formatDateShort(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric'
        });
    }
};

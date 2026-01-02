/**
 * map_renderer.js - Handles Leaflet Map Logic
 */

class MapRenderer {
    constructor(mapId) {
        // Default Center: Seoul City Hall
        this.map = L.map(mapId, { zoomControl: false }).setView([37.5665, 126.9780], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=ko', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.markers = L.layerGroup().addTo(this.map);
        this.pathLayer = L.layerGroup().addTo(this.map);

        this.userLocationMarker = null;
    }

    // Go to User Location
    locateUser() {
        this.map.locate({ setView: true, maxZoom: 16 });
        this.map.on('locationfound', (e) => {
            if (this.userLocationMarker) this.map.removeLayer(this.userLocationMarker);

            this.userLocationMarker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'user-location-marker',
                    html: '<div style="background:#4f46e5; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20]
                })
            }).addTo(this.map);
        });
        this.map.on('locationerror', () => {
            alert("위치 정보를 가져올 수 없습니다. GPS 설정을 확인해주세요.");
        });
    }

    // Add Single Marker (Project)
    addMarker(lat, lng, onClick) {
        const marker = L.marker([lat, lng]).addTo(this.markers);
        if (onClick) marker.on('click', onClick);
        return marker;
    }

    // Visualize Path for Client
    drawPath(logs) {
        this.clearLayers();

        if (logs.length === 0) return;

        const latLngs = [];

        logs.forEach((log, index) => {
            const point = [log.lat, log.lng];
            latLngs.push(point);

            // Numbered Marker (1, 2, 3...)
            const iconHtml = `
                <div style="
                    background: #4f46e5; 
                    color: white; 
                    width: 24px; 
                    height: 24px; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                ">${index + 1}</div>
            `;

            const marker = L.marker(point, {
                icon: L.divIcon({
                    className: 'numbered-marker',
                    html: iconHtml,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.pathLayer);

            // Click to see details
            marker.on('click', () => {
                // Should trigger Modal open (handled in app.js via event or callback usually, but simplistic here)
                // In a stricter MVC, we'd pass a callback. 
            });
        });

        // Draw Dashed Polyline
        if (latLngs.length > 1) {
            L.polyline(latLngs, {
                color: '#4f46e5',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10',
                lineJoin: 'round'
            }).addTo(this.pathLayer);

            // Fit bounds to path
            this.map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
        } else {
            this.map.flyTo(latLngs[0], 15);
        }
    }

    clearLayers() {
        this.markers.clearLayers();
        this.pathLayer.clearLayers();
    }
}

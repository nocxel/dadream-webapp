/**
 * map_renderer.js - Handles Naver Map Logic
 */

class MapRenderer {
    constructor(mapId) {
        // Default Center: Seoul City Hall
        const mapOptions = {
            center: new naver.maps.LatLng(37.5665, 126.9780),
            zoom: 15,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: false,
            mapTypeControl: false
        };

        this.map = new naver.maps.Map(mapId, mapOptions);

        this.markers = new Map(); // Key: Pin ID, Value: { marker, infoWindow, content }
        this.pathMarkers = [];
        this.pathPolyline = null;
        this.tempMarkers = [];

        this.userLocationMarker = null;
    }

    // Go to User Location
    locateUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const newCenter = new naver.maps.LatLng(lat, lng);

                this.map.morph(newCenter, 16);

                if (this.userLocationMarker) {
                    this.userLocationMarker.setMap(null);
                }

                this.userLocationMarker = new naver.maps.Marker({
                    position: newCenter,
                    map: this.map,
                    icon: {
                        content: '<div style="background:#4f46e5; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
                        size: new naver.maps.Size(20, 20),
                        anchor: new naver.maps.Point(10, 10)
                    }
                });

            }, (err) => {
                console.error(err);
                alert("위치 정보를 가져올 수 없습니다. GPS 설정을 확인해주세요.");
            });
        } else {
            alert("이 브라우저는 위치 기반 서비스를 지원하지 않습니다.");
        }
    }

    // Add or Update Marker (State-Based)
    addOrUpdateMarker(id, lat, lng, popupContent, type = 'blue') {
        const color = type === 'blue' ? '#4f46e5' : '#ef4444';

        // Icon HTML
        const iconHtml = `
            <div style="
                background: ${color};
                width: 24px;
                height: 24px;
                border-radius: 50% 50% 0 50%;
                transform: rotate(45deg);
                border: 2px solid white;
                box-shadow: 1px 1px 4px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    width: 8px;
                    height: 8px;
                    background: white;
                    border-radius: 50%;
                    transform: rotate(-45deg);
                "></div>
            </div>
        `;

        // Check availability
        if (this.markers.has(id)) {
            // UPDATE Existing
            const item = this.markers.get(id);
            const marker = item.marker;
            const infoWindow = item.infoWindow;

            // 1. Position
            const newPos = new naver.maps.LatLng(lat, lng);
            if (!marker.getPosition().equals(newPos)) {
                marker.setPosition(newPos);
            }

            // 2. Icon (Color change?)
            // We always update content just in case color changed
            marker.setIcon({
                content: iconHtml,
                size: new naver.maps.Size(24, 24),
                anchor: new naver.maps.Point(12, 24)
            });

            // 3. InfoWindow Content
            if (item.content !== popupContent) {
                const newContent = `<div style="padding:10px; background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:none;">${popupContent}</div>`;
                infoWindow.setContent(newContent);
                item.content = popupContent; // Update cache
            }

            return marker;
        } else {
            // CREATE New
            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(lat, lng),
                map: this.map,
                icon: {
                    content: iconHtml,
                    size: new naver.maps.Size(24, 24),
                    anchor: new naver.maps.Point(12, 24)
                }
            });

            const infoWindow = new naver.maps.InfoWindow({
                content: `<div style="padding:10px; background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:none;">${popupContent}</div>`,
                borderWidth: 0,
                backgroundColor: "transparent",
                anchorSize: new naver.maps.Size(0, 0),
                pixelOffset: new naver.maps.Point(0, -10)
            });

            naver.maps.Event.addListener(marker, "click", () => {
                if (infoWindow.getMap()) {
                    infoWindow.close();
                } else {
                    infoWindow.open(this.map, marker);
                }
            });

            this.markers.set(id, { marker, infoWindow, content: popupContent });
            return marker;
        }
    }

    removeMarker(id) {
        if (this.markers.has(id)) {
            const item = this.markers.get(id);
            item.marker.setMap(null);
            // InfoWindow automatically closes if map is null, but good to be explicit if needed
            if (item.infoWindow.getMap()) item.infoWindow.close();
            this.markers.delete(id);
        }
    }

    // Set Base Layer Opacity
    setBaseLayerOpacity(opacity) {
        this.markers.forEach((item) => {
            const marker = item.marker;
            if (typeof marker.setOpacity === 'function') {
                marker.setOpacity(opacity);
            } else if (marker.getElement && marker.getElement()) {
                marker.getElement().style.opacity = opacity;
            }
        });
    }

    // Visualize Path (Overlay)
    drawPath(logs) {
        this.clearPath();
        if (logs.length === 0) return;

        const pathCoords = [];

        logs.forEach((log, index) => {
            const point = new naver.maps.LatLng(log.lat, log.lng);
            pathCoords.push(point);

            const bgColor = log.isCurrent ? '#4f46e5' : '#9ca3af';
            const zIndex = log.isCurrent ? 2000 : 1000;

            const iconHtml = `
                <div style="
                    background: ${bgColor}; 
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

            const marker = new naver.maps.Marker({
                position: point,
                map: this.map,
                zIndex: zIndex,
                icon: {
                    content: iconHtml,
                    size: new naver.maps.Size(24, 24),
                    anchor: new naver.maps.Point(12, 12)
                }
            });

            if (log.projectName) {
                const infoWindow = new naver.maps.InfoWindow({
                    content: `<div style="padding:5px; font-size:12px;"><b>${index + 1}. ${log.projectName}</b><br>${log.notes || ''}</div>`,
                    borderWidth: 1,
                    borderColor: "#ccc"
                });

                naver.maps.Event.addListener(marker, "click", () => {
                    if (infoWindow.getMap()) {
                        infoWindow.close();
                    } else {
                        infoWindow.open(this.map, marker);
                    }
                });
            }

            this.pathMarkers.push(marker);
        });

        if (pathCoords.length > 1) {
            this.pathPolyline = new naver.maps.Polyline({
                map: this.map,
                path: pathCoords,
                strokeColor: '#9ca3af',
                strokeWeight: 4,
                strokeOpacity: 0.8,
                strokeStyle: 'shortdash'
            });
        }
    }

    triggerPathMarkerClick(index) {
        if (this.pathMarkers[index]) {
            naver.maps.Event.trigger(this.pathMarkers[index], 'click');
        }
    }

    fitBounds(coords) {
        if (!coords || coords.length === 0) return;
        const bounds = new naver.maps.LatLngBounds();
        coords.forEach(c => bounds.extend(c));
        this.map.fitBounds(bounds, {
            top: 50, bottom: 300, left: 50, right: 50 // Bottom padding for sheet
        });
    }

    flyTo(lat, lng, zoom = 15) {
        const newCenter = new naver.maps.LatLng(lat, lng);
        this.map.morph(newCenter, zoom);
    }

    clearPath() {
        this.pathMarkers.forEach(m => m.setMap(null));
        this.pathMarkers = [];
        if (this.pathPolyline) {
            this.pathPolyline.setMap(null);
            this.pathPolyline = null;
        }
    }

    clearMarkers() {
        this.markers.forEach((item) => item.marker.setMap(null));
        this.markers.clear();
    }

    clearLayers() {
        this.clearMarkers();
        this.clearPath();
        this.tempMarkers.forEach(m => m.setMap(null));
        this.tempMarkers = [];
    }

    addTempPin(lat, lng, title) {
        this.tempMarkers.forEach(m => m.setMap(null));
        this.tempMarkers = [];

        const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(lat, lng),
            map: this.map,
            icon: {
                content: '<div style="background:#ef4444; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.3);"></div>',
                size: new naver.maps.Size(20, 20),
                anchor: new naver.maps.Point(10, 10)
            }
        });

        if (title) {
            const infoWindow = new naver.maps.InfoWindow({
                content: `<div style="padding:5px; font-size:12px;">${title}</div>`,
                borderWidth: 1,
                borderColor: "#ef4444"
            });
            infoWindow.open(this.map, marker);
        }

        this.tempMarkers.push(marker);
        return marker;
    }
}
export default MapRenderer;

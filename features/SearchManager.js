export default class SearchManager {
    constructor(store, mapRenderer, uiManager) {
        this.store = store;
        this.mapRenderer = mapRenderer;
        this.ui = uiManager;

        this.globalSearch = document.getElementById('globalSearch');
        this.searchResults = document.getElementById('searchResults');
        this.btnClearPath = document.getElementById('btnClearPath');

        this.searchTimeout = null;

        this.init();
    }

    init() {
        this.globalSearch.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.performSearch(e.target.value), 300);
        });

        this.btnClearPath.addEventListener('click', () => {
            this.mapRenderer.clearPath();
            // Clear temp markers manually if not supported by renderer
            if (this.mapRenderer.tempMarkers) {
                this.mapRenderer.tempMarkers.forEach(m => m.setMap(null));
                this.mapRenderer.tempMarkers = [];
            } else if (this.mapRenderer.tempLayer) {
                this.mapRenderer.tempLayer.clearLayers();
            }

            this.mapRenderer.setBaseLayerOpacity(1.0);
            this.globalSearch.value = '';
            this.searchResults.classList.add('hidden');
            this.btnClearPath.classList.add('hidden');

            // Close Sidebar Completely and Clear Data
            const sidebar = document.getElementById('trajectorySidebar');
            const trajectoryList = document.getElementById('trajectoryList');
            if (sidebar) {
                sidebar.classList.add('hidden'); // Hide completely
                sidebar.classList.add('collapsed'); // Reset to collapsed state for clean accumulation if needed, or just hidden
            }
            if (trajectoryList) {
                trajectoryList.innerHTML = ''; // Clear data
            }
        });

        this.initMobileDrag();
    }

    initMobileDrag() {
        const handle = document.getElementById('mobileDragHandle');
        const sidebar = document.getElementById('trajectorySidebar');
        if (!handle || !sidebar) return;

        let startY = 0;
        let startHeight = 0;
        let isDragging = false;

        handle.addEventListener('touchstart', (e) => {
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = sidebar.getBoundingClientRect().height;
            sidebar.style.transition = 'none'; // Disable transition during drag
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const currentY = e.touches[0].clientY;
            const deltaY = startY - currentY; // Drag up = positive delta
            const newHeight = startHeight + deltaY;

            // Limits
            if (newHeight >= 100 && newHeight <= (window.innerHeight * 0.95)) {
                sidebar.style.height = `${newHeight}px`;
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            sidebar.style.transition = ''; // Restore transition

            // Auto Snap close if too small
            if (sidebar.offsetHeight < 150) {
                sidebar.classList.add('collapsed');
                sidebar.style.height = ''; // Reset to default CSS
            }
        });
    }

    async performSearch(query) {
        if (!query) {
            this.searchResults.classList.add('hidden');
            return;
        }

        this.searchResults.innerHTML = '<div style="padding:10px;">검색중...</div>';
        this.searchResults.classList.remove('hidden');

        // 1. Reps (Local)
        const reps = this.store.getReps().filter(r => r.name.includes(query));

        // 2. Pins (Local)
        const pins = this.store.getPins().filter(p => p.siteName.includes(query) || p.address.includes(query));

        // 3. Naver Geocode (Remote)
        if (!naver.maps.Service || !naver.maps.Service.geocode) {
            this.renderSearchResults(reps, pins, []);
            return;
        }

        naver.maps.Service.geocode({
            query: query
        }, (status, response) => {
            let places = [];
            if (status === naver.maps.Service.Status.OK) {
                const result = response.v2;
                if (result.addresses.length > 0) {
                    places = result.addresses;
                }
            }
            this.renderSearchResults(reps, pins, places);
        });
    }

    renderSearchResults(reps, pins, places) {
        this.searchResults.innerHTML = '';
        const hasResults = (reps.length + pins.length + places.length) > 0;

        if (!hasResults) {
            this.searchResults.innerHTML = `
                <div class="search-empty">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p style="margin:8px 0;">검색 결과가 없습니다.</p>
                    <a href="https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(this.globalSearch.value)}" 
                       target="_blank" 
                       class="glass-btn small-btn" 
                       style="display:inline-flex; text-decoration:none; margin-top:8px;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> 네이버 지도에서 찾기
                    </a>
                </div>`;
            return;
        }

        // 1. NAVER ADDRESS RESULTS
        if (places.length > 0) {
            const h = document.createElement('div');
            h.className = 'search-section-header';
            h.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> 장소 / 주소';
            this.searchResults.appendChild(h);

            places.forEach(p => {
                const el = document.createElement('div');
                el.className = 'search-item';
                const road = p.roadAddress;
                const jibun = p.jibunAddress;
                const displayName = road || jibun;
                const subName = road ? jibun : '';

                el.innerHTML = `
                    <div class="search-icon-box map-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="search-info">
                        <strong class="search-title">${displayName}</strong>
                        ${subName ? `<span class="search-sub">${subName}</span>` : ''}
                    </div>
                    <button class="search-action-btn">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;
                el.onclick = () => {
                    const lat = parseFloat(p.y);
                    const lng = parseFloat(p.x);
                    this.mapRenderer.flyTo(lat, lng, 15);
                    this.mapRenderer.addTempPin(lat, lng, displayName);
                    this.globalSearch.value = displayName;
                    this.searchResults.classList.add('hidden');
                    this.btnClearPath.classList.remove('hidden');
                };
                this.searchResults.appendChild(el);
            });
        }

        // 2. MY SAVED PINS
        if (pins.length > 0) {
            const h = document.createElement('div');
            h.className = 'search-section-header';
            h.innerHTML = '<i class="fa-solid fa-house-chimney"></i> 내 저장 현장';
            this.searchResults.appendChild(h);

            pins.forEach(p => {
                const el = document.createElement('div');
                el.className = 'search-item';
                el.innerHTML = `
                    <div class="search-icon-box pin-icon">
                        <i class="fa-solid fa-house"></i>
                    </div>
                    <div class="search-info">
                        <strong class="search-title">${p.siteName}</strong>
                        <span class="search-sub">${p.address}</span>
                    </div>
                `;
                el.onclick = () => {
                    this.mapRenderer.flyTo(p.lat, p.lng, 15);
                    this.searchResults.classList.add('hidden');
                    this.btnClearPath.classList.remove('hidden');
                };
                this.searchResults.appendChild(el);
            });
        }

        // 3. REPRESENTATIVES
        if (reps.length > 0) {
            const h = document.createElement('div');
            h.className = 'search-section-header';
            h.innerHTML = '<i class="fa-solid fa-users"></i> 담당자';
            this.searchResults.appendChild(h);

            reps.forEach(r => {
                const el = document.createElement('div');
                el.className = 'search-item';
                el.innerHTML = `
                    <div class="search-icon-box rep-icon">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="search-info">
                        <strong class="search-title">${r.name}</strong>
                        <span class="search-sub">${r.phone || '연락처 없음'}</span>
                    </div>
                `;
                el.onclick = () => {
                    this.globalSearch.value = r.name;
                    this.searchResults.classList.add('hidden');
                    this.showTrajectory(r.id);
                };
                this.searchResults.appendChild(el);
            });
        }
    }

    showTrajectory(repId) {
        const logs = this.store.getRepLogs(repId);
        const activePin = this.store.getRepActivePin(repId);
        const rep = this.store.getRep(repId);

        // UI Setup
        const sidebar = document.getElementById('trajectorySidebar');
        const trajectoryList = document.getElementById('trajectoryList');
        const trajectoryRepName = document.getElementById('trajectoryRepName');
        const btnToggleSidebar = document.getElementById('btnToggleSidebar');

        if (!sidebar) {
            console.error("Sidebar element not found");
            return;
        }

        // Toggle Logic
        btnToggleSidebar.onclick = () => {
            sidebar.classList.toggle('collapsed');
            const Icon = btnToggleSidebar.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                Icon.className = 'fa-solid fa-chevron-right';
            } else {
                Icon.className = 'fa-solid fa-chevron-left';
            }
        };

        // Initialize State: Open
        sidebar.classList.remove('hidden'); // Make visible
        sidebar.classList.remove('collapsed'); // Expand
        btnToggleSidebar.querySelector('i').className = 'fa-solid fa-chevron-left';

        trajectoryRepName.textContent = `${rep ? rep.name : 'Unknown'}님의 이동 경로`;
        trajectoryList.innerHTML = '';

        // Prepare data
        const validLogs = logs.map(l => {
            const pin = this.store.getPin(l.pinId);
            if (!pin) return null;
            const isCurrent = (pin.status === 'active' && pin.repId === repId);
            return {
                ...l,
                lat: pin.lat,
                lng: pin.lng,
                projectName: pin.siteName,
                notes: pin.notes,
                isCurrent: isCurrent
            };
        }).filter(Boolean);

        // Sort by Time DESC for List
        const sortedLogs = [...validLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedLogs.length === 0) {
            trajectoryList.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">기록이 없습니다.</div>';
            this.ui.showToast("방문 기록이 없습니다.");
            return;
        }

        // Render List
        sortedLogs.forEach((log, i) => {
            const originalIndex = validLogs.indexOf(log);

            const item = document.createElement('div');
            item.className = 'traj-item';
            const timeStr = new Date(log.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

            item.innerHTML = `
                <div class="traj-index">${originalIndex + 1}</div>
                <div class="traj-info" style="flex:1;">
                    <h4>${log.projectName}</h4>
                    <p><i class="fa-regular fa-clock"></i> ${timeStr} ${log.isCurrent ? '<span style="color:#4f46e5; font-weight:bold;">(활동중)</span>' : ''}</p>
                </div>
                <button class="glass-btn icon-only small-btn delete-log-btn" style="color:#ef4444; margin-left:8px;" title="기록 삭제">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Item Click (Fly + Trigger)
            item.onclick = (() => {
                // Move Map
                this.mapRenderer.flyTo(log.lat, log.lng, 15);
                this.mapRenderer.triggerPathMarkerClick(originalIndex);
            });

            // Delete Button Click
            const btnDelete = item.querySelector('.delete-log-btn');
            btnDelete.onclick = (e) => {
                e.stopPropagation(); // Prevent item click
                if (confirm('정말 이 방문 기록을 삭제하시겠습니까?')) {
                    this.store.deleteLog(log.id);
                    this.showTrajectory(repId); // Refresh
                }
            };

            trajectoryList.appendChild(item);
        });

        // Map Action
        if (validLogs.length > 0) {
            this.mapRenderer.setBaseLayerOpacity(0.3);
            this.mapRenderer.drawPath(validLogs);
            this.btnClearPath.classList.remove('hidden');

            // Collect all points for bounds
            const points = validLogs.map(l => new naver.maps.LatLng(l.lat, l.lng));
            if (activePin) points.push(new naver.maps.LatLng(activePin.lat, activePin.lng));

            // Auto Fit
            this.mapRenderer.fitBounds(points);
        }
    }
}

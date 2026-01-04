import './Search.css';

export default class SearchManager {
    constructor(store, mapRenderer, uiManager) {
        this.store = store;
        this.mapRenderer = mapRenderer;
        this.ui = uiManager;

        this.injectUI();

        this.globalSearch = document.getElementById('globalSearch');
        this.searchResults = document.getElementById('searchResults');

        // These are injected, so re-query only when needed or after inject
        this.btnClearPath = document.getElementById('btnClearPath');

        this.searchTimeout = null;

        this.init();
    }

    injectUI() {
        if (document.getElementById('trajectorySidebar')) return;

        const template = `
            <!-- Clear Path Button -->
            <button id="btnClearPath" class="clear-path-btn-fixed hidden">
                <i class="fa-solid fa-times-circle" style="color:#ef4444; font-size:16px;"></i>
                <span>동선 지우기 (검색 종료)</span>
            </button>

            <!-- Trajectory Sidebar -->
            <div id="trajectorySidebar" class="sidebar hidden collapsed">
                <div class="sidebar-wrapper">
                    <!-- Mobile Drag Handle -->
                    <div id="mobileDragHandle" class="sheet-handle-area">
                        <div class="sheet-handle-bar"></div>
                    </div>

                    <div class="sidebar-header">
                        <h3 id="trajectoryRepName">이동 경로</h3>
                        <button id="btnCloseTrajectory" class="glass-btn icon-only small-btn" style="display:none;"><i
                                class="fa-solid fa-times"></i></button>
                    </div>
                    <div class="sidebar-body" id="trajectoryList">
                        <!-- Timeline Items -->
                    </div>
                </div>

                <button id="btnToggleSidebar" class="sidebar-toggle glass-btn">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>
        `;

        const range = document.createRange();
        document.body.appendChild(range.createContextualFragment(template));

        this.btnClearPath = document.getElementById('btnClearPath');
    }

    init() {
        if (this.globalSearch) {
            this.globalSearch.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => this.performSearch(e.target.value), 300);
            });
        }

        if (this.btnClearPath) {
            this.btnClearPath.addEventListener('click', () => {
                try {
                    this.mapRenderer.clearPath();
                    // Clear temp markers manually if not supported by renderer
                    if (this.mapRenderer.tempMarkers) {
                        this.mapRenderer.tempMarkers.forEach(m => m.setMap(null));
                        this.mapRenderer.tempMarkers = [];
                    } else if (this.mapRenderer.tempLayer) {
                        this.mapRenderer.tempLayer.clearLayers();
                    }

                    this.mapRenderer.setBaseLayerOpacity(1.0);
                } catch (e) {
                    console.error("Error clearing search path:", e);
                } finally {
                    if (this.globalSearch) this.globalSearch.value = '';
                    if (this.searchResults) this.searchResults.classList.add('hidden');
                    this.btnClearPath.classList.add('hidden');

                    // Close Sidebar Completely and Clear Data
                    const sidebar = document.getElementById('trajectorySidebar');
                    const trajectoryList = document.getElementById('trajectoryList');
                    if (sidebar) {
                        sidebar.classList.add('hidden'); // Hide completely
                        sidebar.classList.add('collapsed'); // Reset to collapsed state
                    }
                    if (trajectoryList) {
                        trajectoryList.innerHTML = ''; // Clear data
                    }
                }
            });
        }

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

        try {
            // 1. Contacts (Local)
            const allContacts = await this.store.getContacts();
            const contacts = allContacts.filter(c => (c.name || '').includes(query));

            // 2. Pins (Local)
            const allPins = await this.store.getPins();
            const pins = allPins.filter(p => (p.title || '').includes(query) || (p.address || '').includes(query));

            // 3. Naver Geocode (Remote)
            if (!naver.maps.Service || !naver.maps.Service.geocode) {
                this.renderSearchResults(contacts, pins, []);
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
                this.renderSearchResults(contacts, pins, places);
            });
        } catch (error) {
            console.error("Search failed", error);
            this.searchResults.innerHTML = '<div style="padding:10px; color:red;">검색 오류</div>';
        }
    }

    renderSearchResults(contacts, pins, places) {
        this.searchResults.innerHTML = '';
        const hasResults = (contacts.length + pins.length + places.length) > 0;

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
                        <strong class="search-title">${p.title}</strong>
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

        // 3. CONTACTS
        if (contacts.length > 0) {
            const h = document.createElement('div');
            h.className = 'search-section-header';
            h.innerHTML = '<i class="fa-solid fa-briefcase"></i> 거래처(담당자)';
            this.searchResults.appendChild(h);

            contacts.forEach(c => {
                const el = document.createElement('div');
                el.className = 'search-item';
                el.innerHTML = `
                    <div class="search-icon-box rep-icon">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="search-info">
                        <strong class="search-title">${c.name}</strong>
                        <span class="search-sub">${c.phone || '연락처 없음'}</span>
                    </div>
                `;
                el.onclick = () => {
                    this.globalSearch.value = c.name;
                    this.searchResults.classList.add('hidden');
                    this.showTrajectory(c.id);
                };
                this.searchResults.appendChild(el);
            });
        }
    }

    async showTrajectory(contactId) {
        // Parallel Fetch: Logs, Active Pin, Contact Info
        const [logs, activePin, contact] = await Promise.all([
            this.store.getContactLogs(contactId),
            this.store.getContactActivePin(contactId),
            this.store.getContact(contactId)
        ]);

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

        trajectoryRepName.textContent = `${contact ? contact.name : 'Unknown'}님의 현장 기록`;
        trajectoryList.innerHTML = '';

        // Prepare data with Pin Details
        const validLogs = await Promise.all(logs.map(async l => {
            const pin = await this.store.getPin(l.pinId);
            if (!pin) return null;
            const isCurrent = (pin.status === 'active' && pin.contactId === contactId);
            return {
                ...l,
                lat: pin.lat,
                lng: pin.lng,
                projectName: pin.title,
                notes: pin.notes,
                isCurrent: isCurrent
            };
        }));

        const filteredLogs = validLogs.filter(Boolean);

        // Sort by Time DESC for List
        const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedLogs.length === 0) {
            trajectoryList.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">기록이 없습니다.</div>';
            this.ui.showToast("방문 기록이 없습니다.");
            return;
        }

        // Render List
        sortedLogs.forEach((log, i) => {
            const originalIndex = filteredLogs.indexOf(log);

            const item = document.createElement('div');
            item.className = 'traj-item';
            const timeStr = new Date(log.date).toLocaleDateString('ko-KR') + ' ' + new Date(log.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

            item.innerHTML = `
                <div class="traj-index">${originalIndex + 1}</div>
                <div class="traj-info" style="flex:1;">
                    <h4>${log.projectName}</h4>
                    <p><i class="fa-regular fa-clock"></i> ${timeStr} ${log.isCurrent ? '<span style="color:#4f46e5; font-weight:bold;">(현재 담당)</span>' : ''}</p>
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
            btnDelete.onclick = async (e) => {
                e.stopPropagation(); // Prevent item click
                if (confirm('정말 이 방문 기록을 삭제하시겠습니까?')) {
                    await this.store.deleteLog(log.id);
                    this.showTrajectory(contactId); // Refresh
                }
            };

            trajectoryList.appendChild(item);
        });

        // Map Action
        if (filteredLogs.length > 0) {
            this.mapRenderer.setBaseLayerOpacity(0.3);
            this.mapRenderer.drawPath(filteredLogs);
            this.btnClearPath.classList.remove('hidden');

            // Collect all points for bounds
            const points = filteredLogs.map(l => new naver.maps.LatLng(l.lat, l.lng));
            if (activePin) points.push(new naver.maps.LatLng(activePin.lat, activePin.lng));

            // Auto Fit with Responsive Padding
            const isMobile = window.innerWidth <= 600;
            const padding = isMobile
                ? { top: 50, bottom: 300, left: 20, right: 20 }
                : { top: 50, bottom: 50, left: 350, right: 50 }; // 350px = 320px sidebar + 30px buffer

            this.mapRenderer.fitBounds(points, padding);
        }
    }
}

import './Layout.css';

export default class LayoutManager {
    constructor() {
        this.injectLayout();
    }

    injectLayout() {
        // Prevent duplicate injection
        if (document.getElementById('appContent')) return;

        const template = `
            <!-- Main App Content (Hidden by default, managed by AuthManager) -->
            <div id="appContent" class="hidden" style="width: 100%; height: 100%;">
                <!-- Header / Search Bar -->
                <header class="app-header glass-panel">
                    <div class="search-container">
                        <i class="fa-solid fa-search search-icon"></i>
                        <input type="text" id="globalSearch" placeholder="지역명, 담당자, 현장 검색..." autocomplete="off">
                        <button id="btnContacts" class="header-btn" title="거래처(담당자) 관리">
                            <i class="fa-solid fa-users" style="font-size:18px;"></i>
                        </button>
                        <button id="btnHistory" class="header-btn" title="전체 내역">
                            <i class="fa-solid fa-list-check" style="font-size:18px;"></i>
                        </button>
                        <button id="btnLogout" class="header-btn danger" title="로그아웃">
                            <i class="fa-solid fa-right-from-bracket" style="font-size:18px;"></i>
                        </button>
                        <div id="searchResults" class="search-results hidden glass-panel"></div>
                    </div>
                </header>

                <!-- Map Container -->
                <div id="map" style="width: 100%; height: 100%; z-index: 1;"></div>

                <!-- GPS Button -->
                <button id="btnMyLocation" class="map-control-btn glass-btn">
                    <i class="fa-solid fa-location-crosshairs"></i>
                </button>

                <!-- Floating Action Button (FAB) -->
                <button id="fabMain" class="fab">
                    <i class="fa-solid fa-plus"></i>
                </button>

                <!-- Modals Overlay (Shared) -->
                <div id="modalOverlay" class="modal-overlay hidden"></div>
            </div>
        `;

        // Inject into body
        const range = document.createRange();
        const fragment = range.createContextualFragment(template);
        document.body.prepend(fragment);
    }
}

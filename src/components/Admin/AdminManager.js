import Utils from '../../../utils.js';
import './Admin.css';

export default class AdminManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

        this.injectModal(); // Dynamic Injection

        this.btnHistory = document.getElementById('btnHistory');
        this.adminModal = document.getElementById('adminModal');
        this.adminTimeline = document.getElementById('adminTimeline');

        // Re-query inputs in init or renders, as they are dynamic now
        // this.filterInputs = document.querySelectorAll('input[name="adminFilter"]');

        this.init();
    }

    injectModal() {
        if (document.getElementById('adminModal')) return;
        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;

        const template = `
            <div id="adminModal" class="modal-card glass-panel hidden admin-modal-height">
                <div class="modal-header">
                    <h2>전체 활동 내역</h2>
                    <div class="modal-actions">
                        <button class="close-btn"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
                <div class="modal-body no-padding">
                    <!-- Filter Tabs -->
                    <div class="segmented-control admin-tabs" style="margin:16px;">
                        <input type="radio" name="adminFilter" value="all" id="af_all" checked>
                        <label for="af_all">전체</label>
                        <input type="radio" name="adminFilter" value="active" id="af_active">
                        <label for="af_active">활성(Active)</label>
                        <input type="radio" name="adminFilter" value="new" id="af_new">
                        <label for="af_new">신규(New)</label>
                    </div>
                    <div class="timeline-container timeline-no-pad-top" id="adminTimeline">
                        <!-- List Items -->
                    </div>
                </div>
            </div>
        `;

        const range = document.createRange();
        overlay.appendChild(range.createContextualFragment(template));

        // Re-query
        this.adminModal = document.getElementById('adminModal');
        this.adminTimeline = document.getElementById('adminTimeline');
    }

    init() {
        if (this.btnHistory) {
            this.btnHistory.addEventListener('click', () => {
                this.ui.openModal('adminModal');
                this.renderAdminHistory();
            });
        }

        // Delegate listener for dynamic radio buttons
        if (this.adminModal) {
            this.adminModal.addEventListener('change', (e) => {
                if (e.target.name === 'adminFilter') {
                    this.renderAdminHistory();
                }
            });
        }

        // Global
        window.deleteLog = (id) => this.deleteLog(id);
    }

    async renderAdminHistory() {
        if (!this.adminTimeline) return;

        this.adminTimeline.innerHTML = '<div style="padding:20px; text-align:center;">로딩중...</div>';

        const filterEl = document.querySelector('input[name="adminFilter"]:checked');
        const filter = filterEl ? filterEl.value : 'all';

        try {
            // Optimized: Fetch Reps map once (efficient for both views)
            const reps = await this.store.getReps();
            const repMap = new Map();
            reps.forEach(r => repMap.set(r.id, r));

            // Clear loading only before rendering
            this.adminTimeline.innerHTML = '';

            if (filter === 'all') {
                const logs = await this.store.getLogs(); // Fetches all logs sorted by ID desc

                for (const l of logs) {
                    const diffDiv = document.createElement('div');
                    diffDiv.className = 'timeline-item';

                    diffDiv.innerHTML = `
                        <div class="timeline-marker" style="background:#9ca3af"></div>
                        <div class="timeline-content">
                            <div style="display:flex; justify-content:space-between;">
                                <h4>${l.projectName}</h4>
                                <button onclick="window.deleteLog('${l.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;" title="로그 삭제"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            <p style="font-size:12px; color:#666;">${Utils.formatDate(l.date)} ${Utils.formatTime(l.date)}</p>
                            <p style="font-size:13px;">담당자: ${l.contactName || '알수없음'}</p>
                        </div>
                     `;
                    this.adminTimeline.appendChild(diffDiv);
                }
            } else {
                let pins = await this.store.getPins();
                if (filter === 'active') pins = pins.filter(p => p.status === 'active');
                if (filter === 'new') pins = pins.filter(p => p.status === 'new');

                pins.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'timeline-item';

                    let infoHtml = '';
                    if (p.status === 'active') {
                        infoHtml = `<p style="font-size:13px;">담당자: ${p.contactName || '알수없음'}</p>`;
                    } else {
                        infoHtml = `<p style="font-size:13px;">담당자: 미배정</p>`;
                    }

                    div.innerHTML = `
                        <div class="timeline-marker" style="background:${p.status === 'active' ? '#4f46e5' : '#ef4444'}"></div>
                        <div class="timeline-content">
                            <h4>${p.title} <span style="font-size:11px;">(${p.status})</span></h4>
                            <p style="font-size:12px; color:#666;">${p.address}</p>
                            ${infoHtml}
                        </div>
                     `;
                    this.adminTimeline.appendChild(div);
                });
            }
        } catch (e) {
            console.error("Error rendering history:", e);
            this.adminTimeline.innerHTML = '<div style="padding:20px; text-align:center; color:red;">데이터 로딩 실패</div>';
        }
    }

    async deleteLog(id) {
        if (confirm("이 활동 로그를 영구 삭제하시겠습니까?")) {
            await this.store.deleteLog(id);
            await this.renderAdminHistory();
            this.ui.showToast("로그가 삭제되었습니다.");
        }
    }
}

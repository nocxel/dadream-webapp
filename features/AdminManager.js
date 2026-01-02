import Utils from '../utils.js';

export default class AdminManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

        this.btnHistory = document.getElementById('btnHistory');
        this.adminModal = document.getElementById('adminModal');
        this.adminTimeline = document.getElementById('adminTimeline');
        this.filterInputs = document.querySelectorAll('input[name="adminFilter"]');

        this.init();
    }

    init() {
        this.btnHistory.addEventListener('click', () => {
            this.ui.openModal('adminModal');
            this.renderAdminHistory();
        });

        this.filterInputs.forEach(r => {
            r.addEventListener('change', () => this.renderAdminHistory());
        });

        // Global
        window.deleteLog = (id) => this.deleteLog(id);
    }

    renderAdminHistory() {
        this.adminTimeline.innerHTML = '';
        const filter = document.querySelector('input[name="adminFilter"]:checked').value;

        let logs = this.store.getLogs();
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filter === 'all') {
            logs.forEach(l => {
                const diffDiv = document.createElement('div');
                diffDiv.className = 'timeline-item';
                const r = this.store.getRep(l.repId);
                const p = this.store.getPin(l.pinId);
                if (!p) return;

                diffDiv.innerHTML = `
                    <div class="timeline-marker" style="background:#9ca3af"></div>
                    <div class="timeline-content">
                        <div style="display:flex; justify-content:space-between;">
                            <h4>${p.siteName}</h4>
                            <button onclick="window.deleteLog('${l.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;" title="로그 삭제"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <p style="font-size:12px; color:#666;">${Utils.formatDate(l.date)} ${Utils.formatTime(l.date)}</p>
                        <p style="font-size:13px;">담당: ${r ? r.name : '삭제됨'}</p>
                    </div>
                 `;
                this.adminTimeline.appendChild(diffDiv);
            });
        } else {
            let pins = this.store.getPins();
            if (filter === 'active') pins = pins.filter(p => p.status === 'active');
            if (filter === 'new') pins = pins.filter(p => p.status === 'new');

            pins.forEach(p => {
                const div = document.createElement('div');
                div.className = 'timeline-item';
                const rep = this.store.getRep(p.repId);
                div.innerHTML = `
                    <div class="timeline-marker" style="background:${p.status === 'active' ? '#4f46e5' : '#ef4444'}"></div>
                    <div class="timeline-content">
                        <h4>${p.siteName} <span style="font-size:11px;">(${p.status})</span></h4>
                        <p style="font-size:12px; color:#666;">${p.address}</p>
                        <p style="font-size:13px;">담당: ${rep ? rep.name : '미배정'}</p>
                    </div>
                 `;
                this.adminTimeline.appendChild(div);
            });
        }
    }

    deleteLog(id) {
        if (confirm("이 활동 로그를 영구 삭제하시겠습니까?")) {
            this.store.deleteLog(id);
            this.renderAdminHistory();
            this.ui.showToast("로그가 삭제되었습니다.");
        }
    }
}

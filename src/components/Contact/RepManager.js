import './Contact.css'; // Shared styles

export default class RepManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

        this.injectModal();

        // Elements
        this.btnReps = document.getElementById('btnReps');
        this.repManagerModal = document.getElementById('repManagerModal');
        this.repAddForm = document.getElementById('repAddForm');
        this.repList = document.getElementById('repList');
        this.repSearchInput = document.getElementById('repSearchInput');
        this.btnRepSubmit = document.getElementById('btnRepSubmit');
        this.btnRepCancelEdit = document.getElementById('btnRepCancelEdit');
        this.editRepIdInput = document.getElementById('editRepId');
        this.btnImportContacts = document.getElementById('btnImportContacts');

        this.init();
    }

    injectModal() {
        if (document.getElementById('repManagerModal')) return;
        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;

        const template = `
            <div id="repManagerModal" class="modal-card glass-panel hidden modal-flex-col contact-modal-height">
                <div class="modal-header">
                    <h2>담당자 관리</h2>
                    <div class="modal-actions">
                        <button class="close-btn"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
                <div class="modal-body no-padding modal-scroll-body">
                    <div class="modal-sticky-header">
                        <div class="form-section-card">
                            <div class="form-section-header" style="justify-content: space-between;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <i class="fa-solid fa-user-plus"></i>
                                    <span>신규 담당자 등록</span>
                                </div>
                                <button id="btnImportContacts" class="glass-btn small-btn rep-import-btn">
                                    <i class="fa-solid fa-address-book"></i> 연락처 가져오기
                                </button>
                            </div>
                            <form id="repAddForm" class="premium-form">
                                <input type="hidden" id="editRepId">

                                <div class="input-group">
                                    <div class="input-with-icon premium">
                                        <i class="fa-solid fa-user input-icon"></i>
                                        <input type="text" id="newRepName" placeholder="이름을 입력하세요"
                                            class="glass-input premium-input" required>
                                    </div>
                                </div>

                                <div class="input-group">
                                    <div class="input-with-icon premium">
                                        <i class="fa-solid fa-phone input-icon"></i>
                                        <input type="tel" id="newRepPhone" placeholder="휴대폰 번호 (- 없이 입력)"
                                            class="glass-input premium-input">
                                    </div>
                                </div>

                                <div class="form-actions">
                                    <button type="submit" id="btnRepSubmit" class="premium-btn primary">
                                        <i class="fa-solid fa-plus"></i> 추가하기
                                    </button>
                                    <button type="button" id="btnRepCancelEdit" class="premium-btn secondary hidden">
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Search Input Added -->
                        <div style="margin-top:12px;">
                            <div class="input-with-icon premium">
                                <i class="fa-solid fa-magnifying-glass input-icon"></i>
                                <input type="text" id="repSearchInput" placeholder="담당자 이름으로 검색..."
                                    class="glass-input premium-input">
                            </div>
                        </div>
                    </div>
                    <div class="timeline-container timeline-no-pad-top" id="repList">
                        <!-- Rep Items -->
                    </div>
                </div>
            </div>
        `;

        const range = document.createRange();
        overlay.appendChild(range.createContextualFragment(template));

        // Re-query
        this.repManagerModal = document.getElementById('repManagerModal');
        this.repAddForm = document.getElementById('repAddForm');
        this.repList = document.getElementById('repList');
        this.repSearchInput = document.getElementById('repSearchInput');
        this.btnRepSubmit = document.getElementById('btnRepSubmit');
        this.btnRepCancelEdit = document.getElementById('btnRepCancelEdit');
        this.editRepIdInput = document.getElementById('editRepId');
        this.btnImportContacts = document.getElementById('btnImportContacts');
    }

    init() {
        // Open Modal
        if (this.btnReps) {
            this.btnReps.addEventListener('click', () => {
                this.ui.openModal('repManagerModal');
                this.cancelRepEdit();
                this.renderRepList();
            });
        }

        // Add/Edit Submit
        if (this.repAddForm) this.repAddForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Search
        if (this.repSearchInput) this.repSearchInput.addEventListener('input', (e) => this.renderRepList(e.target.value));

        // Cancel Edit
        if (this.btnRepCancelEdit) this.btnRepCancelEdit.addEventListener('click', () => this.cancelRepEdit());

        // Contact Import
        if (this.btnImportContacts) {
            this.initContactImport();
        }

        // Global Bindings for HTML onclick
        window.startEditRep = (id) => this.startEdit(id);
        window.deleteRep = (id) => this.deleteRep(id);
    }

    async handleSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('newRepName').value.trim();
        const phone = document.getElementById('newRepPhone').value.trim();
        const editId = this.editRepIdInput.value;

        try {
            if (editId) {
                await this.store.updateRep(editId, name, phone);
                this.ui.showToast('담당자 정보가 수정되었습니다.');
                this.cancelRepEdit();
            } else {
                await this.store.addRep(name, phone);
                document.getElementById('newRepName').value = '';
                document.getElementById('newRepPhone').value = '';
                this.ui.showToast('담당자가 추가되었습니다.');
            }
            await this.renderRepList();
        } catch (err) {
            alert(err.message);
        }
    }

    async renderRepList(filterName = '') {
        if (!this.repList) return;
        this.repList.innerHTML = '<div style="padding:20px; text-align:center;">로딩중...</div>';
        try {
            let reps = await this.store.getReps();

            if (filterName) {
                reps = reps.filter(r => r.name.includes(filterName));
            }

            this.repList.innerHTML = '';

            if (reps.length === 0) {
                this.repList.innerHTML = '<div style="padding:20px; text-align:center;">담당자가 없습니다.</div>';
                return;
            }

            reps.forEach(r => {
                const div = document.createElement('div');
                div.className = 'rep-card';
                div.innerHTML = `
                    <div class="rep-info">
                        <div class="rep-avatar">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <div class="rep-name">${r.name}</div>
                            <div class="rep-phone">${r.phone || '연락처 없음'}</div>
                        </div>
                    </div>
                    <div class="rep-actions">
                        <button onclick="window.startEditRep('${r.id}')" class="action-btn edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="window.deleteRep('${r.id}')" class="action-btn delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                this.repList.appendChild(div);
            });
        } catch (error) {
            console.error(error);
            this.repList.innerHTML = '<div style="padding:20px; text-align:center; color:red;">불러오기 실패</div>';
        }
    }

    async startEdit(id) {
        const rep = await this.store.getRep(id);
        if (!rep) return;

        this.editRepIdInput.value = rep.id;
        document.getElementById('newRepName').value = rep.name;
        document.getElementById('newRepPhone').value = rep.phone;

        this.btnRepSubmit.innerHTML = '<i class="fa-solid fa-check"></i> 변경사항 저장';
        this.btnRepCancelEdit.classList.remove('hidden');
    }

    cancelRepEdit() {
        this.editRepIdInput.value = '';
        document.getElementById('newRepName').value = '';
        document.getElementById('newRepPhone').value = '';
        this.btnRepSubmit.innerHTML = '<i class="fa-solid fa-plus"></i> 추가하기';
        this.btnRepCancelEdit.classList.add('hidden');
    }

    async deleteRep(id) {
        if (confirm("정말 삭제하시겠습니까? (복구 불가)")) {
            try {
                await this.store.deleteRep(id);
                await this.renderRepList();
                this.ui.showToast('삭제되었습니다.');
            } catch (err) {
                alert("삭제 실패: " + err.message);
            }
        }
    }

    initContactImport() {
        const isSupported = ('contacts' in navigator && 'ContactsManager' in window);
        if (!isSupported) {
            this.btnImportContacts.onclick = () => {
                alert("이 기능은 안드로이드/Chrome 모바일에서만 지원됩니다.\n(PC나 iOS에서는 지원되지 않을 수 있습니다)");
            };
        } else {
            this.btnImportContacts.onclick = async () => {
                try {
                    const props = ['name', 'tel'];
                    const options = { multiple: true };
                    const contacts = await navigator.contacts.select(props, options);

                    if (contacts.length === 0) return;

                    let addedCount = 0;

                    // Process sequentially 
                    for (const c of contacts) {
                        const name = c.name ? c.name[0] : '이름없음';
                        const phoneRaw = c.tel ? c.tel[0] : '';
                        const phone = phoneRaw.trim();

                        if (name) {
                            try {
                                await this.store.addRep(name, phone);
                                addedCount++;
                            } catch (e) {
                                console.log(`Skipped duplicate or error: ${name}`);
                            }
                        }
                    }

                    if (addedCount > 0) {
                        this.ui.showToast(`${addedCount}명의 연락처를 가져왔습니다.`);
                        await this.renderRepList();
                    }
                } catch (err) {
                    // console.error(err);
                }
            };
        }
    }
}

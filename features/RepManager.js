export default class RepManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

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

    init() {
        // Open Modal
        this.btnReps.addEventListener('click', () => {
            this.ui.openModal('repManagerModal');
            this.cancelRepEdit();
            this.renderRepList();
        });

        // Add/Edit Submit
        this.repAddForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Search
        this.repSearchInput.addEventListener('input', (e) => this.renderRepList(e.target.value));

        // Cancel Edit
        this.btnRepCancelEdit.addEventListener('click', () => this.cancelRepEdit());

        // Contact Import
        if (this.btnImportContacts) {
            this.initContactImport();
        }

        // Global Bindings for HTML onclick
        window.startEditRep = (id) => this.startEdit(id);
        window.deleteRep = (id) => this.deleteRep(id);
    }

    handleSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('newRepName').value.trim();
        const phone = document.getElementById('newRepPhone').value.trim();
        const editId = this.editRepIdInput.value;

        try {
            if (editId) {
                this.store.updateRep(editId, name, phone);
                this.ui.showToast('담당자 정보가 수정되었습니다.');
                this.cancelRepEdit();
            } else {
                this.store.addRep(name, phone);
                document.getElementById('newRepName').value = '';
                document.getElementById('newRepPhone').value = '';
                this.ui.showToast('담당자가 추가되었습니다.');
            }
            this.renderRepList();
        } catch (err) {
            alert(err.message);
        }
    }

    renderRepList(filterName = '') {
        this.repList.innerHTML = '';
        let reps = this.store.getReps();

        if (filterName) {
            reps = reps.filter(r => r.name.includes(filterName));
        }

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
    }

    startEdit(id) {
        const rep = this.store.getRep(id);
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

    deleteRep(id) {
        if (confirm("정말 삭제하시겠습니까? (복구 불가)")) {
            this.store.deleteRep(id);
            this.renderRepList();
            this.ui.showToast('삭제되었습니다.');
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
                    contacts.forEach(c => {
                        const name = c.name ? c.name[0] : '이름없음';
                        const phoneRaw = c.tel ? c.tel[0] : '';
                        const phone = phoneRaw.trim();

                        if (name) {
                            try {
                                this.store.addRep(name, phone);
                                addedCount++;
                            } catch (e) {
                                console.log(`Skipped duplicate: ${name}`);
                            }
                        }
                    });

                    if (addedCount > 0) {
                        this.ui.showToast(`${addedCount}명의 연락처를 가져왔습니다.`);
                        this.renderRepList();
                    }
                } catch (err) {
                    // console.error(err);
                }
            };
        }
    }
}

import './Contact.css';

export default class ContactManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

        this.injectModals();

        this.listElement = document.getElementById('contactList');
        this.addForm = document.getElementById('contactAddForm');
        this.searchInput = document.getElementById('contactSearchInput');

        this.isEditing = false;
        this.editId = null;

        // Initialize immediately if elements exist (in case of re-injection)
        // delayed init via init() called by App
    }

    injectModals() {
        if (document.getElementById('contactManagerModal')) return;

        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;

        const contactTemplate = `
            <div id="contactManagerModal" class="modal-card glass-panel hidden contact-modal-height">
                <div class="modal-header">
                    <h2>거래처(고객) 관리</h2>
                    <div class="modal-actions">
                        <button class="close-btn"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
                
                <!-- Search & Filters (Sticky) -->
                <div class="search-area-sticky">
                    <div class="input-with-icon premium">
                        <i class="fa-solid fa-magnifying-glass input-icon"></i>
                        <input type="text" id="contactSearchInput" placeholder="거래처명 / 연락처 검색..."
                            class="glass-input premium-input">
                    </div>
                </div>

                <!-- Add Form Container (Expandable) -->
                <div id="contactAddFormContainer" class="add-form-container">
                    <div class="form-section-card">
                         <div class="form-section-header" style="justify-content: space-between; margin-bottom: 16px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-user-plus" style="color:var(--primary-color);"></i>
                                <span style="font-weight:bold;">새 거래처 등록</span>
                            </div>
                            <button id="btnImportContactsVal" class="glass-btn small-btn rep-import-btn">
                                <i class="fa-solid fa-address-book"></i> 연락처 가져오기
                            </button>
                        </div>

                        <form id="contactAddForm" class="premium-form">
                            <input type="hidden" id="editContactId">

                            <div class="input-group">
                                <div class="input-with-icon premium">
                                    <i class="fa-solid fa-briefcase input-icon"></i>
                                    <input type="text" id="newContactName" placeholder="거래처명 / 담당자명"
                                        class="glass-input premium-input" required>
                                </div>
                            </div>

                            <div class="input-group">
                                <div class="input-with-icon premium">
                                    <i class="fa-solid fa-phone input-icon"></i>
                                    <input type="tel" id="newContactPhone" placeholder="연락처 (- 없이 입력)"
                                        class="glass-input premium-input">
                                </div>
                            </div>

                            <div class="form-actions" style="margin-top:20px;">
                                <button type="submit" id="btnContactSubmit" class="premium-btn primary">
                                    <i class="fa-solid fa-check"></i> 저장하기
                                </button>
                                <button type="button" id="btnContactCancelEdit" class="premium-btn secondary">
                                    취소 / 닫기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- List Content -->
                <div class="timeline-container timeline-no-pad-top" id="contactList">
                    <!-- Contact Items -->
                </div>

                <!-- FAB Add Button -->
                <button id="fabAddContact" class="fab-add-contact">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;

        const clientTemplate = `
            <div id="clientModal" class="modal-card glass-panel hidden bottom-sheet">
                <div class="modal-header">
                    <h2 id="clientModalTitle">담당자 상세</h2>
                    <div class="modal-actions">
                        <button id="btnCallClient" class="glass-btn icon-only success-color"><i
                                class="fa-solid fa-phone"></i></button>
                        <button class="close-btn"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
                <div class="modal-body no-padding">
                    <div class="timeline-container" id="clientTimeline">
                        <!-- Timeline items injected here -->
                    </div>
                </div>
            </div>
        `;

        const range = document.createRange();
        overlay.appendChild(range.createContextualFragment(contactTemplate));
        overlay.appendChild(range.createContextualFragment(clientTemplate));

        this.listElement = document.getElementById('contactList');
        this.addForm = document.getElementById('contactAddForm');
        this.searchInput = document.getElementById('contactSearchInput');
        this.addFormContainer = document.getElementById('contactAddFormContainer');
        this.fabAdd = document.getElementById('fabAddContact');
        this.btnCancel = document.getElementById('btnContactCancelEdit');
    }

    async init() {
        const btnContacts = document.getElementById('btnContacts');
        if (btnContacts) {
            btnContacts.addEventListener('click', () => {
                this.ui.openModal('contactManagerModal');
                this.renderContactList();
                this.closeAddForm(); // Start with list view
            });
        }

        if (this.addForm) {
            this.addForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.cancelEdit());
        }

        if (this.fabAdd) {
            this.fabAdd.addEventListener('click', () => this.openAddForm());
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.filterContacts(e.target.value));
        }

        const btnImport = document.getElementById('btnImportContactsVal');
        if (btnImport) {
            this.initContactImport(btnImport);
        }

        await this.renderContactList();
    }

    openAddForm() {
        if (this.addFormContainer) {
            this.addFormContainer.classList.add('open');
            // FAB Hidden when form is open to avoid clutter? Or keep it? kept for now.
            this.fabAdd.classList.add('hidden');
            document.getElementById('newContactName').focus();
        }
    }

    closeAddForm() {
        if (this.addFormContainer) {
            this.addFormContainer.classList.remove('open');
            this.fabAdd.classList.remove('hidden');
            this.cancelEdit(false); // Reset form but don't toggle UI again
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newContactName');
        const phoneInput = document.getElementById('newContactPhone');

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        if (!name) {
            this.ui.showToast('고객명(상호명)을 입력해주세요.');
            return;
        }

        try {
            if (this.isEditing && this.editId) {
                await this.store.updateContact(this.editId, name, phone);
                this.ui.showToast('거래처 정보가 수정되었습니다.');
            } else {
                await this.store.addContact(name, phone);
                this.ui.showToast('새 거래처가 등록되었습니다.');
            }

            nameInput.value = '';
            phoneInput.value = '';

            // Close form after success
            this.closeAddForm();
            await this.renderContactList();

        } catch (error) {
            console.error(error);
            this.ui.showToast('오류가 발생했습니다: ' + error.message);
        }
    }

    async renderContactList() {
        if (!this.listElement) return;

        this.listElement.innerHTML = '<div style="padding:20px; text-align:center;">로딩중...</div>';

        try {
            const contacts = await this.store.getContacts();
            this.listElement.innerHTML = '';

            if (contacts.length === 0) {
                this.listElement.innerHTML = `
                    <div style="padding:40px 20px; text-align:center; color:#94a3b8;">
                        <i class="fa-solid fa-clipboard-list" style="font-size:32px; margin-bottom:12px; opacity:0.5;"></i>
                        <p>등록된 거래처가 없습니다.</p>
                        <p style="font-size:12px;">+ 버튼을 눌러 추가해보세요</p>
                    </div>`;
                return;
            }

            contacts.forEach(contact => {
                const item = document.createElement('div');
                item.className = 'timeline-item'; // New card style

                // Phone display
                const phoneDisplay = contact.phone
                    ? `<p><i class="fa-solid fa-phone"></i> ${contact.phone}</p>`
                    : '<p><i class="fa-solid fa-phone-slash"></i> 연락처 없음</p>';

                item.innerHTML = `
                    <div style="flex:1;">
                        <h4>${contact.name}</h4>
                        ${phoneDisplay}
                    </div>
                    <div class="action-btn-group">
                        <button class="list-action-btn edit edit-btn"><i class="fa-solid fa-pen"></i></button>
                        <button class="list-action-btn delete delete-btn"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;

                // Events
                item.querySelector('.edit-btn').onclick = () => this.startEdit(contact);
                item.querySelector('.delete-btn').onclick = () => this.deleteContact(contact.id);

                this.listElement.appendChild(item);
            });

        } catch (err) {
            console.error(err);
            this.listElement.innerHTML = '<div style="padding:20px; text-align:center; color:red;">불러오기 실패</div>';
        }
    }

    startEdit(contact) {
        this.isEditing = true;
        this.editId = contact.id;

        document.getElementById('newContactName').value = contact.name;
        document.getElementById('newContactPhone').value = contact.phone || '';
        document.getElementById('editContactId').value = contact.id;

        // Open layout
        this.openAddForm();

        // UX: Change button text? kept same as "Save" is generic enough
    }

    cancelEdit(uiToggle = true) {
        this.isEditing = false;
        this.editId = null;

        const nameInput = document.getElementById('newContactName');
        const phoneInput = document.getElementById('newContactPhone');
        const idInput = document.getElementById('editContactId');

        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (idInput) idInput.value = '';

        if (uiToggle) {
            this.closeAddForm();
        }
    }

    async deleteContact(id) {
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                await this.store.deleteContact(id);
                this.ui.showToast('삭제되었습니다.');
                await this.renderContactList();
            } catch (err) {
                this.ui.showToast('삭제 실패: ' + err.message);
            }
        }
    }

    filterContacts(query) {
        if (!this.listElement) return;
        // Simple client-side filtering matching new structure
        const items = this.listElement.querySelectorAll('.timeline-item');
        items.forEach(item => {
            const name = item.querySelector('h4').textContent.toLowerCase();
            const phone = item.querySelector('p').textContent.toLowerCase();
            const q = query.toLowerCase();

            if (name.includes(q) || phone.includes(q)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    initContactImport(btnImport) {
        const isSupported = ('contacts' in navigator && 'ContactsManager' in window);
        if (!isSupported) {
            btnImport.onclick = () => {
                alert("이 기능은 안드로이드/Chrome 모바일에서만 지원됩니다.\n(PC나 iOS에서는 지원되지 않을 수 있습니다)");
            };
        } else {
            btnImport.onclick = async () => {
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
                                await this.store.addContact(name, phone);
                                addedCount++;
                            } catch (e) {
                                console.log(`Skipped duplicate or error: ${name}`);
                            }
                        }
                    }

                    if (addedCount > 0) {
                        this.ui.showToast(`${addedCount}명의 연락처를 가져왔습니다.`);
                        await this.renderContactList();
                    }
                } catch (err) {
                    // console.error(err);
                }
            };
        }
    }
}

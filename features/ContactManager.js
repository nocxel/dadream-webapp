export default class ContactManager {
    constructor(store, uiManager) {
        this.store = store;
        this.ui = uiManager;

        this.injectModals(); // Dynamic Injection

        this.listElement = document.getElementById('contactList');
        this.addForm = document.getElementById('contactAddForm');
        this.searchInput = document.getElementById('contactSearchInput');

        this.isEditing = false;
        this.editId = null;
    }

    injectModals() {
        if (document.getElementById('contactManagerModal')) return;
        const overlay = document.getElementById('modalOverlay');
        const contactTemplate = document.getElementById('contact-manager-template');
        const clientTemplate = document.getElementById('client-modal-template');

        if (!overlay || !contactTemplate || !clientTemplate) return;

        overlay.appendChild(contactTemplate.content.cloneNode(true));
        overlay.appendChild(clientTemplate.content.cloneNode(true));
    }

    async init() {
        // Open Modal Button Binding
        const btnContacts = document.getElementById('btnContacts');
        if (btnContacts) {
            btnContacts.addEventListener('click', () => {
                this.ui.openModal('contactManagerModal');
                this.renderContactList();
            });
        }

        if (this.addForm) {
            this.addForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const btnCancel = document.getElementById('btnContactCancelEdit');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cancelEdit());
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.filterContacts(e.target.value));
        }

        // Import Button
        const btnImport = document.getElementById('btnImportContactsVal');
        if (btnImport) {
            this.initContactImport(btnImport);
        }

        await this.renderContactList();
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
            this.cancelEdit();
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
                this.listElement.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">등록된 거래처가 없습니다.</div>';
                return;
            }

            contacts.forEach(contact => {
                const item = document.createElement('div');
                item.className = 'timeline-item glass-panel';
                item.style.marginBottom = '10px';

                // Phone display
                const phoneDisplay = contact.phone ? `<div style="font-size:13px; color:#666; margin-top:4px;"><i class="fa-solid fa-phone"></i> ${contact.phone}</div>` : '';

                item.innerHTML = `
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="font-size:16px;">${contact.name}</strong>
                        </div>
                        ${phoneDisplay}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="glass-btn icon-only small-btn edit-btn" style="color:#4f46e5;"><i class="fa-solid fa-pen"></i></button>
                        <button class="glass-btn icon-only small-btn delete-btn" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
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

        const btnSubmit = document.getElementById('btnContactSubmit');
        const btnCancel = document.getElementById('btnContactCancelEdit');

        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> 수정하기';
        btnCancel.classList.remove('hidden');

        // Scroll to top
        this.addForm.scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        this.isEditing = false;
        this.editId = null;
        document.getElementById('newContactName').value = '';
        document.getElementById('newContactPhone').value = '';
        document.getElementById('editContactId').value = '';

        const btnSubmit = document.getElementById('btnContactSubmit');
        const btnCancel = document.getElementById('btnContactCancelEdit');

        btnSubmit.innerHTML = '<i class="fa-solid fa-plus"></i> 추가하기';
        btnCancel.classList.add('hidden');
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
        const items = this.listElement.querySelectorAll('.timeline-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query.toLowerCase())) {
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

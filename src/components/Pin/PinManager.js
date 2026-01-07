import Utils from '../../../utils.js';
import './Pin.css';

export default class PinManager {
    constructor(store, mapRenderer, uiManager) {
        this.store = store;
        this.mapRenderer = mapRenderer;
        this.ui = uiManager;

        this.injectHtml(); // Dynamic Injection

        // Elements
        this.activityForm = document.getElementById('activityForm');
        this.btnUpload = document.getElementById('btnUpload');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.fileName = document.getElementById('fileName');
        this.repSelect = document.getElementById('repSelect');
        this.btnDeletePin = document.getElementById('btnDeletePin');
        this.fabMain = document.getElementById('fabMain');
        this.btnMyLocation = document.getElementById('btnMyLocation');
        this.formModal = document.getElementById('formModal');
        // We need to be careful with cross-component references (e.g. repManagerModal)
        // ideally loose coupling, but for now we query selector safely

        // State
        this.currentUploadBase64 = null;
        this.selectedLocation = null;
        this.isEditMode = false;
        this.currentEditingPinId = null;

        this.init();
    }

    injectHtml() {
        if (document.getElementById('formModal')) return;

        const overlay = document.getElementById('modalOverlay');
        if (!overlay) return;

        const template = `
            <div id="formModal" class="modal-card glass-panel hidden">
                <div class="modal-header">
                    <h2 id="modalTitle">현장 등록/수정</h2>
                    <button class="close-btn"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <form id="activityForm">
                        <input type="hidden" id="editPinId">

                        <!-- Mapping Info -->
                        <div class="form-section-card">
                            <div class="form-section-header">
                                <i class="fa-solid fa-map-location-dot"></i> 기본 정보
                            </div>
                            <div class="premium-form">
                                <div class="input-with-icon premium">
                                    <i class="fa-solid fa-sign-hanging input-icon"></i>
                                    <input type="text" id="siteName" placeholder="현장명 (예: XX빌라, XX상가)" class="glass-input premium-input" required>
                                </div>
                                <div style="display:flex; flex-direction:column;">
                                    <div class="input-with-icon premium">
                                        <i class="fa-solid fa-location-dot input-icon"></i>
                                        <input type="text" id="addressInput" placeholder="주소 자동 입력" class="glass-input premium-input" readonly>
                                    </div>
                                    <div id="addressFeedback" class="selected-address"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact Assignment -->
                        <div class="form-section-card">
                            <div class="form-section-header">
                                <i class="fa-solid fa-user-tag"></i> 담당자(거래처) 배정
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <select id="repSelect" class="glass-input premium-input" style="width:100%;">
                                    <option value="">-- 담당자(거래처) 미배정 --</option>
                                </select>
                                <div id="repPhoneDisplay" style="margin-top:8px; font-size:13px; color:#4f46e5; font-weight:bold;"></div>
                            </div>
                        </div>

                        <!-- Details -->
                        <div class="form-group">
                            <label>현장 사진</label>
                            <div class="file-upload-box">
                                <button type="button" id="btnUpload" class="glass-btn small-btn"><i class="fa-solid fa-camera"></i> 사진 촬영/선택</button>
                                <input type="file" id="imageInput" accept="image/*" hidden>
                                <span id="fileName" class="file-name">선택된 파일 없음</span>
                            </div>
                            <img id="imagePreview" src="" class="hidden form-preview-img">
                        </div>

                        <div class="form-group">
                            <label>특이사항 / 메모</label>
                            <textarea id="notes" rows="3" placeholder="내용 입력"></textarea>
                        </div>

                        <button type="submit" class="submit-btn white-text">저장하기</button>
                        <button type="button" id="btnDeletePin" class="submit-btn delete-pin-btn">현장 삭제</button>
                    </form>
                </div>
            </div>
        `;

        // Inject into Overlay
        const range = document.createRange();
        const fragment = range.createContextualFragment(template);
        overlay.appendChild(fragment);
    }

    async init() {
        // FAB
        if (this.fabMain) {
            this.fabMain.addEventListener('click', () => {
                const center = this.mapRenderer.map.getCenter();
                this.openPinForm({ lat: center.y, lng: center.x, address: '지도 위치' });
            });
        }

        // My Location
        if (this.btnMyLocation) {
            this.btnMyLocation.addEventListener('click', () => {
                this.mapRenderer.locateUser();
            });
        }

        // Image Upload
        if (this.btnUpload) this.btnUpload.addEventListener('click', () => this.imageInput.click());
        if (this.imageInput) this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // Submit
        if (this.activityForm) this.activityForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Delete
        if (this.btnDeletePin) this.btnDeletePin.addEventListener('click', () => this.handleDelete());

        // Contact Phone Display
        if (this.repSelect) {
            this.repSelect.onchange = async () => {
                if (!this.repSelect.value) {
                    const el = document.getElementById('repPhoneDisplay');
                    if (el) el.textContent = '';
                    return;
                }
                const c = await this.store.getContact(this.repSelect.value);
                const el = document.getElementById('repPhoneDisplay');
                if (el) el.textContent = c ? c.phone : '';
            };
        }

        // Global Handlers
        window.editPin = async (id) => {
            const pin = await this.store.getPin(id);
            if (pin) this.openPinForm(pin, true);
        };
        window.completePin = (id) => this.completePin(id);

        this.bindMapEvents();
        this.bindMapEvents();
        // Event-Driven Rendering: Wait for data
        window.addEventListener('dadream-data-loaded', () => {
            console.log("👂 [PinManager] Data Loaded Signal Received. Rendering...");
            this.refreshMapMarkers();
        });

        // Initial Check: If data already loaded before we got here
        if (this.store.isDataLoaded) {
            console.log("⚡ [PinManager] Data already ready. Immediate Render.");
            this.refreshMapMarkers();
        }
    }

    bindMapEvents() {
        naver.maps.Event.addListener(this.mapRenderer.map, 'click', (e) => {
            const lat = e.coord.y;
            const lng = e.coord.x;

            if (!naver.maps.Service || !naver.maps.Service.reverseGeocode) {
                console.warn("Geocoder submodule not loaded");
                return this.openPinForm({ lat, lng, address: '주소 검색 불가 (모듈 미로드)' });
            }

            naver.maps.Service.reverseGeocode({
                coords: e.coord,
                orders: [naver.maps.Service.OrderType.ADDR, naver.maps.Service.OrderType.ROAD_ADDR].join(',')
            }, (status, response) => {
                if (status !== naver.maps.Service.Status.OK) {
                    return this.openPinForm({ lat, lng, address: '주소 인식 실패' });
                }

                const result = response.v2;
                const items = result.results;
                let address = result.address.jibunAddress;

                if (items.length > 0) {
                    const road = items.find(it => it.name === 'roadaddr');
                    if (road) {
                        address = road.region.area1.name + ' ' + road.region.area2.name + ' ' + road.land.name + ' ' + road.land.number1;
                        if (road.land.number2) address += '-' + road.land.number2;
                    } else {
                        const addr = items.find(it => it.name === 'addr');
                        if (addr) {
                            address = addr.region.area1.name + ' ' + addr.region.area2.name + ' ' + addr.region.area3.name + ' ' + addr.land.number1;
                            if (addr.land.number2) address += '-' + addr.land.number2;
                        }
                    }
                }
                this.openPinForm({ lat, lng, address: address || '주소 없음' });
            });
        });
    }

    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.fileName.textContent = file.name;
        try {
            const compressed = await Utils.compressImage(file);
            this.currentUploadBase64 = compressed;
            this.imagePreview.src = compressed;
            this.imagePreview.classList.remove('hidden');
        } catch (err) {
            console.error(err);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const title = document.getElementById('siteName').value.trim();
        const notes = document.getElementById('notes').value;
        const newContactId = this.repSelect.value || null;

        try {
            const proceed = await this.checkContactAvailability(newContactId, this.isEditMode ? this.currentEditingPinId : null);
            if (!proceed) return;

            if (this.isEditMode && this.currentEditingPinId) {
                await this.handlePinUpdate(this.currentEditingPinId, title, newContactId, notes, this.currentUploadBase64);
            } else {
                await this.store.addPin({
                    title,
                    address: this.selectedLocation.address,
                    lat: this.selectedLocation.lat,
                    lng: this.selectedLocation.lng,
                    contactId: newContactId,
                    photo: this.currentUploadBase64,
                    notes
                });
                this.ui.showToast('현장이 등록되었습니다.');
            }

            this.ui.closeAllModals();
            setTimeout(() => this.refreshMapMarkers(), 50);
        } catch (err) {
            alert(err.message);
        }
    }

    async openPinForm(data, isEdit = false) {
        this.ui.openModal('formModal');
        // Close others by class just in case to avoid ID coupling
        document.querySelectorAll('.modal-card').forEach(m => {
            if (m.id !== 'formModal') m.classList.add('hidden');
        });

        this.activityForm.reset();
        this.imagePreview.classList.add('hidden');
        this.imagePreview.src = '';
        this.currentUploadBase64 = null;
        if (this.btnDeletePin) this.btnDeletePin.style.display = isEdit ? 'block' : 'none';

        this.isEditMode = isEdit;

        // Populate Contacts
        this.repSelect.innerHTML = '<option value="">로딩중...</option>';
        const contacts = await this.store.getContacts();
        this.repSelect.innerHTML = '<option value="">-- 담당자(거래처) 미배정 --</option>';
        contacts.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.phone ? ` (${c.phone})` : '');
            this.repSelect.appendChild(opt);
        });

        if (isEdit) {
            this.currentEditingPinId = data.id;
            this.selectedLocation = { lat: data.lat, lng: data.lng, address: data.address };

            document.getElementById('addressInput').value = data.address;
            document.getElementById('siteName').value = data.title;
            document.getElementById('notes').value = data.notes;

            // Set Contact Selection
            if (data.contactId) {
                this.repSelect.value = data.contactId;
                const c = contacts.find(co => co.id === data.contactId);
                const el = document.getElementById('repPhoneDisplay');
                if (el) el.textContent = c ? c.phone : '';
            }

            if (data.photo) {
                this.imagePreview.src = data.photo;
                this.imagePreview.classList.remove('hidden');
                this.currentUploadBase64 = data.photo;
            }
        } else {
            this.currentEditingPinId = null;
            this.selectedLocation = data;
            document.getElementById('addressInput').value = data.address;
            document.getElementById('siteName').focus();
        }
    }

    async refreshMapMarkers() {
        const [pins, contacts] = await Promise.all([
            this.store.getPins(),
            this.store.getContacts()
        ]);

        const contactMap = new Map();
        contacts.forEach(c => contactMap.set(c.id, c));

        pins.forEach(pin => {
            if (pin.status === 'complete') {
                this.mapRenderer.removeMarker(pin.id);
                return;
            }

            const color = pin.status === 'active' ? 'blue' : 'red';
            let popupContent = '';

            if (pin.status === 'active') {
                const fallbackContact = contactMap.get(pin.contactId);
                const displayName = pin.contactName || (fallbackContact ? fallbackContact.name : '알수없음');
                const displayPhone = pin.contactPhone || (fallbackContact ? fallbackContact.phone : '');
                const displaySub = displayPhone ? `(${displayPhone})` : '';

                popupContent = `
                    <div style="min-width:180px;">
                        <b style="color:#4f46e5; font-size:14px;">${pin.title}</b>
                        <div style="font-size:12px; color:#666; margin-bottom:8px;">
                            <i class="fa-solid fa-briefcase"></i> ${displayName} ${displaySub}
                        </div>
                        <button class="glass-btn small-btn full-width" onclick="window.editPin('${pin.id}')">
                            <i class="fa-solid fa-pen"></i> 관리/수정
                        </button>
                        <button class="glass-btn small-btn full-width" onclick="window.completePin('${pin.id}')" style="margin-top:4px; background:#ef4444; color:white;">
                            <i class="fa-solid fa-check"></i> 현장 종료
                        </button>
                    </div>
                `;
            } else {
                popupContent = `
                    <div style="min-width:180px;">
                        <b style="color:#ef4444; font-size:14px;">${pin.title}</b>
                        <div style="font-size:11px; color:#ef4444; font-weight:bold; margin-bottom:8px;">[담당자 미배정]</div>
                        <p style="font-size:11px; color:#666;">${pin.address}</p>
                        <button class="glass-btn small-btn full-width success-bg" onclick="window.editPin('${pin.id}')" style="color:white;">
                            <i class="fa-solid fa-user-plus"></i> 상세 / 배정
                        </button>
                    </div>
                `;
            }

            this.mapRenderer.addOrUpdateMarker(pin.id, pin.lat, pin.lng, popupContent, color);
        });
    }

    async checkContactAvailability(contactId, currentPinId) {
        if (!contactId) return true;
        const activePin = await this.store.getContactActivePin(contactId);
        if (activePin && activePin.id !== currentPinId) {
            const contact = await this.store.getContact(contactId);
            const confirmMsg = `[${contact.name}]님은 현재 [${activePin.title}] 담당으로 배정되어 있습니다.\n\n기존 배정을 '종료'하고 이 현장으로 새로 배정하시겠습니까?`;
            if (confirm(confirmMsg)) {
                await this.store.updatePin(activePin.id, { status: 'complete', contactId: null });
                return true;
            } else {
                return false;
            }
        }
        return true;
    }

    async handlePinUpdate(pinId, newTitle, newContactId, newNotes, newPhoto) {
        const pin = await this.store.getPin(pinId);
        await this.store.updatePin(pinId, {
            title: newTitle,
            notes: newNotes,
            photo: newPhoto
        });

        const oldContactId = pin.contactId;

        // Condition A: Contact Changed
        if (oldContactId && newContactId !== oldContactId) {
            await this.store.unassignContact(pinId);
        }

        // Condition B: Assigned New Contact
        if (newContactId && newContactId !== oldContactId) {
            await this.store.assignContact(pinId, newContactId);
        }
    }

    async completePin(id) {
        if (confirm("정말 이 현장을 종료(Complete) 처리하시겠습니까?\n지도에서 숨겨집니다.")) {
            try {
                await this.store.updatePin(id, { status: 'complete', contactId: null });
                await this.refreshMapMarkers();
                this.ui.showToast("현장이 종료되었습니다.");
            } catch (error) {
                alert("처리 실패: " + error.message);
            }
        }
    }

    async handleDelete() {
        if (!this.currentEditingPinId) return;
        const pin = await this.store.getPin(this.currentEditingPinId);
        if (!confirm(`'${pin.title}' 현장을 삭제하시겠습니까?`)) return;

        try {
            await this.store.deletePin(pin.id);
            this.mapRenderer.removeMarker(pin.id);
            this.ui.closeAllModals();
            await this.refreshMapMarkers();
            this.ui.showToast('현장이 삭제되었습니다.');
        } catch (error) {
            alert("삭제 실패: " + error.message);
        }
    }
}

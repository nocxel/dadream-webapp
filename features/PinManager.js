import Utils from '../utils.js';

export default class PinManager {
    constructor(store, mapRenderer, uiManager) {
        this.store = store;
        this.mapRenderer = mapRenderer;
        this.ui = uiManager;

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
        this.repManagerModal = document.getElementById('repManagerModal');
        this.adminModal = document.getElementById('adminModal');

        // State
        this.currentUploadBase64 = null;
        this.selectedLocation = null;
        this.isEditMode = false;
        this.currentEditingPinId = null;

        this.init();
    }

    init() {
        // FAB
        this.fabMain.addEventListener('click', () => {
            const center = this.mapRenderer.map.getCenter();
            this.openPinForm({ lat: center.y, lng: center.x, address: '지도 위치' });
        });

        // My Location
        this.btnMyLocation.addEventListener('click', () => {
            this.mapRenderer.locateUser();
        });

        // Image Upload
        this.btnUpload.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // Submit
        this.activityForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Delete
        this.btnDeletePin.addEventListener('click', () => this.handleDelete());

        // Rep Phone Display
        this.repSelect.onchange = () => {
            const r = this.store.getRep(this.repSelect.value);
            document.getElementById('repPhoneDisplay').textContent = r ? r.phone : '';
        };

        // Global Handlers
        window.editPin = (id) => this.openPinForm(this.store.getPin(id), true);
        window.completePin = (id) => this.completePin(id);

        this.bindMapEvents();
        this.refreshMapMarkers();
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
        const siteName = document.getElementById('siteName').value.trim();
        const notes = document.getElementById('notes').value;
        const newRepId = this.repSelect.value || null;

        try {
            const proceed = this.checkRepAvailability(newRepId, this.isEditMode ? this.currentEditingPinId : null);
            if (!proceed) return;

            if (this.isEditMode && this.currentEditingPinId) {
                await this.handlePinUpdate(this.currentEditingPinId, siteName, newRepId, notes, this.currentUploadBase64);
            } else {
                this.store.addPin({
                    siteName,
                    address: this.selectedLocation.address,
                    lat: this.selectedLocation.lat,
                    lng: this.selectedLocation.lng,
                    repId: newRepId,
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

    openPinForm(data, isEdit = false) {
        this.ui.openModal('formModal');
        this.repManagerModal.classList.add('hidden');
        this.adminModal.classList.add('hidden');

        this.activityForm.reset();
        this.imagePreview.classList.add('hidden');
        this.imagePreview.src = '';
        this.currentUploadBase64 = null;
        this.btnDeletePin.style.display = isEdit ? 'block' : 'none';

        this.isEditMode = isEdit;

        // Populate Reps
        const reps = this.store.getReps();
        this.repSelect.innerHTML = '<option value="">-- 담당자 미배정 (New) --</option>';
        reps.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            this.repSelect.appendChild(opt);
        });

        if (isEdit) {
            this.currentEditingPinId = data.id;
            this.selectedLocation = { lat: data.lat, lng: data.lng, address: data.address };

            document.getElementById('addressInput').value = data.address;
            document.getElementById('siteName').value = data.siteName;
            document.getElementById('notes').value = data.notes;
            if (data.repId) {
                this.repSelect.value = data.repId;
                // trigger change
                const r = this.store.getRep(data.repId);
                document.getElementById('repPhoneDisplay').textContent = r ? r.phone : '';
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

    refreshMapMarkers() {
        // Instead of clearing all, we update existing or add new
        const pins = this.store.getPins();

        pins.forEach(pin => {
            if (pin.status === 'complete') {
                this.mapRenderer.removeMarker(pin.id);
                return;
            }

            const color = pin.status === 'active' ? 'blue' : 'red';
            let popupContent = '';

            if (pin.status === 'active') {
                const rep = this.store.getRep(pin.repId);
                popupContent = `
                    <div style="min-width:180px;">
                        <b style="color:#4f46e5; font-size:14px;">${pin.siteName}</b>
                        <div style="font-size:12px; color:#666; margin-bottom:8px;">
                            <i class="fa-solid fa-user"></i> ${rep ? rep.name : '알수없음'} (${rep ? rep.phone : ''})
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
                        <b style="color:#ef4444; font-size:14px;">${pin.siteName}</b>
                        <div style="font-size:11px; color:#ef4444; font-weight:bold; margin-bottom:8px;">[미배정]</div>
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

    checkRepAvailability(repId, currentPinId) {
        if (!repId) return true;
        const activePin = this.store.getRepActivePin(repId);
        if (activePin && activePin.id !== currentPinId) {
            const rep = this.store.getRep(repId);
            const confirmMsg = `[${rep.name}]님은 현재 [${activePin.siteName}]에서 활동 중입니다.\n\n기존 현장을 '완료(complete)' 처리하고 이 현장으로 이동시키겠습니까?`;
            if (confirm(confirmMsg)) {
                this.store.updatePin(activePin.id, { status: 'complete', repId: null });
                return true;
            } else {
                return false;
            }
        }
        return true;
    }

    async handlePinUpdate(pinId, newInfoName, newRepId, newNotes, newPhoto) {
        const pin = this.store.getPin(pinId);
        this.store.updatePin(pinId, {
            siteName: newInfoName,
            notes: newNotes,
            photo: newPhoto
        });

        const oldRepId = pin.repId;

        // Condition A: Rep Changed
        if (oldRepId && newRepId !== oldRepId) {
            let isCorrection = false;
            const oldRep = this.store.getRep(oldRepId);
            const msg = `[담당자 변경 감지]\n\n'${oldRep ? oldRep.name : '이전담당자'}'님을 변경합니다. 처리 방식을 선택해주세요.\n\n[확인] = 단순 수정 (기록 삭제)\n[취소] = 현장 인수인계 (기록 보존)`;

            if (confirm(msg)) {
                isCorrection = true;
            }

            if (isCorrection) {
                this.store.unassignRep(pinId);
                this.store.deleteLogByRepAndPin(oldRepId, pinId);
                this.ui.showToast("단순 수정: 이전 담당자 기록이 삭제되었습니다.");
            } else {
                this.store.unassignRep(pinId);
                await this.checkAndRestorePreviousSite(oldRepId, pinId);
            }
        }

        // Condition B: Assigned New Rep
        if (newRepId && newRepId !== oldRepId) {
            this.store.assignRep(pinId, newRepId);
        }
    }

    async checkAndRestorePreviousSite(repId, currentPinIdToIgnore) {
        const allLogs = this.store.getRepLogs(repId);
        const reversed = [...allLogs].reverse();
        const candidateLog = reversed.find(l => l.pinId !== currentPinIdToIgnore);

        if (!candidateLog) return;
        const pastPin = this.store.getPin(candidateLog.pinId);
        if (!pastPin) return;

        if (pastPin.status !== 'active') {
            const rep = this.store.getRep(repId);
            if (confirm(`[담당자: ${rep.name}]\n현재 배정된 현장이 없습니다.\n\n과거 활동 기록(${pastPin.siteName})으로 복귀(Active 전환)하시겠습니까?`)) {
                this.store.assignRep(pastPin.id, repId);
                this.ui.showToast(`${rep.name}님이 ${pastPin.siteName}으로 복귀했습니다.`);
            }
        }
    }

    completePin(id) {
        if (confirm("정말 이 현장을 종료(Complete) 처리하시겠습니까?\n지도에서 숨겨집니다.")) {
            this.store.updatePin(id, { status: 'complete', repId: null });
            this.refreshMapMarkers();
            this.ui.showToast("현장이 종료되었습니다.");
        }
    }

    handleDelete() {
        if (!this.currentEditingPinId) return;
        const pin = this.store.getPin(this.currentEditingPinId);
        if (!confirm(`'${pin.siteName}' 현장을 삭제하시겠습니까?`)) return;

        const oldRepId = pin.repId;
        this.store.deletePin(pin.id);
        this.mapRenderer.removeMarker(pin.id); // Immediate visual removal

        if (pin.status === 'active' && oldRepId) {
            this.checkAndRestorePreviousSite(oldRepId, pin.id);
        }

        this.ui.closeAllModals();
        this.refreshMapMarkers();
        this.ui.showToast('현장이 삭제되었습니다.');
    }
}

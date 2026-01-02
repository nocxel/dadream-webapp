/**
 * Store.js - Relational Data Management
 * Schema:
 *  - Representatives: { id, name (unique), phone }
 *  - Pinpoints: { id, siteName (unique), address, lat, lng, repId (nullable), status ('new'|'active'|'complete'), photo, notes }
 *  - ActivityLogs: { id, repId, pinId, date }
 */

class Store {
    constructor() {
        this.KEY_REPS = 'dadream_reps';
        this.KEY_PINS = 'dadream_pins';
        this.KEY_LOGS = 'dadream_logs';

        this.init();
    }

    init() {
        if (!localStorage.getItem(this.KEY_REPS)) localStorage.setItem(this.KEY_REPS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEY_PINS)) localStorage.setItem(this.KEY_PINS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEY_LOGS)) localStorage.setItem(this.KEY_LOGS, JSON.stringify([]));
    }

    _get(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
    _set(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    _uuid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

    // ===========================
    // Representatives
    // ===========================
    getReps() { return this._get(this.KEY_REPS); }

    getRep(id) { return this.getReps().find(r => r.id === id); }

    getRepByName(name) { return this.getReps().find(r => r.name === name); }

    getRepActivePin(repId) {
        return this.getPins().find(p => p.repId === repId && p.status === 'active');
    }

    addRep(name, phone) {
        const reps = this.getReps();
        if (reps.some(r => r.name === name)) {
            throw new Error(`이미 등록된 담당자 이름입니다: ${name}`);
        }
        const newRep = { id: this._uuid(), name, phone: this._formatPhone(phone) };
        reps.push(newRep);
        this._set(this.KEY_REPS, reps);
        return newRep;
    }

    updateRep(id, newName, newPhone) {
        const reps = this.getReps();
        const rep = reps.find(r => r.id === id);
        if (!rep) throw new Error("담당자를 찾을 수 없습니다.");

        // Name uniqueness check (skip self)
        if (newName && newName !== rep.name) {
            if (reps.some(r => r.name === newName)) {
                throw new Error(`이미 등록된 담당자 이름입니다: ${newName}`);
            }
            // Constraint: "수정: 이름 중복 등록 및 수정 불가"
            rep.name = newName;
        }

        if (newPhone) rep.phone = this._formatPhone(newPhone);

        this._set(this.KEY_REPS, reps);
        return rep;
    }

    deleteRep(id) {
        const reps = this.getReps();
        const newReps = reps.filter(r => r.id !== id);
        this._set(this.KEY_REPS, newReps);
    }

    _formatPhone(phone) {
        if (!phone) return '';
        const num = phone.replace(/\D/g, '');
        if (num.length >= 11) {
            return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
        }
        return num; // Return as is if partial
    }

    // ===========================
    // Pinpoints (Sites)
    // ===========================
    getPins() { return this._get(this.KEY_PINS); }

    getPin(id) { return this.getPins().find(p => p.id === id); }

    addPin(data) {
        // data: { siteName, address, lat, lng, repId (opt), photo, notes }
        const pins = this.getPins();
        if (pins.some(p => p.siteName === data.siteName)) {
            throw new Error(`이미 존재하는 현장 이름입니다: ${data.siteName}`);
        }

        const newPin = {
            id: this._uuid(),
            siteName: data.siteName,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            repId: data.repId || null,
            status: data.repId ? 'active' : 'new', // Logic: Associated Rep -> active
            photo: data.photo || null,
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };

        pins.push(newPin);
        this._set(this.KEY_PINS, pins);

        // If rep assigned immediately, log it
        if (newPin.repId) {
            this.logActivity(newPin.repId, newPin.id);
        }

        return newPin;
    }

    updatePin(id, updates) {
        const pins = this.getPins();
        const pin = pins.find(p => p.id === id);
        if (!pin) throw new Error("현장을 찾을 수 없습니다.");

        // Name Unique Check
        if (updates.siteName && updates.siteName !== pin.siteName) {
            if (pins.some(p => p.siteName === updates.siteName)) {
                throw new Error(`이미 존재하는 현장 이름입니다: ${updates.siteName}`);
            }
            pin.siteName = updates.siteName;
        }

        // Apply other non-relational updates
        if (updates.photo !== undefined) pin.photo = updates.photo;
        if (updates.notes !== undefined) pin.notes = updates.notes;

        // Allow explicit repId update (e.g. set to null for completion)
        if (updates.repId !== undefined) pin.repId = updates.repId;

        // Status manual override? (Usually handled by relational methods, but allowed)
        if (updates.status) pin.status = updates.status;

        this._set(this.KEY_PINS, pins);
        return pin;
    }

    deletePin(id) {
        const pins = this.getPins();
        const idx = pins.findIndex(p => p.id === id);
        if (idx === -1) return false;

        pins.splice(idx, 1);
        this._set(this.KEY_PINS, pins);
        return true;
    }

    // ===========================
    // Logic: Assignments
    // ===========================

    // Assign Rep to Pin
    assignRep(pinId, repId) {
        const pins = this.getPins();
        const pin = pins.find(p => p.id === pinId);
        if (!pin) throw new Error("Pin not found");

        pin.repId = repId;
        pin.status = 'active'; // Case 1: Assigned -> active

        this._set(this.KEY_PINS, pins);
        this.logActivity(repId, pinId);
        return pin;
    }

    // Unassign Rep from Pin
    unassignRep(pinId) {
        const pins = this.getPins();
        const pin = pins.find(p => p.id === pinId);
        if (!pin) throw new Error("Pin not found");

        const oldRepId = pin.repId;
        pin.repId = null;
        pin.status = 'new'; // Case 2: Released -> new

        this._set(this.KEY_PINS, pins);
        return { pin, oldRepId };
    }

    // ===========================
    // Activity Logs
    // ===========================
    getLogs() { return this._get(this.KEY_LOGS); }

    logActivity(repId, pinId) {
        const logs = this.getLogs();
        logs.push({
            id: this._uuid(),
            repId,
            pinId,
            date: new Date().toISOString()
        });
        this._set(this.KEY_LOGS, logs);
    }

    // Get Rep's logs sorted by date (DESC or ASC? Trajectory needs ASC usually)
    getRepLogs(repId) {
        return this.getLogs()
            .filter(l => l.repId === repId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Find the LATEST log for a rep 
    // This returns the MOST RECENT log.
    getRepLatestLog(repId) {
        const logs = this.getRepLogs(repId); // Sorted ASC
        if (logs.length === 0) return null;
        return logs[logs.length - 1]; // Last item is latest
    }

    deleteLog(logId) {
        const logs = this.getLogs();
        const newLogs = logs.filter(l => l.id !== logId);
        this._set(this.KEY_LOGS, newLogs);
    }

    deleteLogByRepAndPin(repId, pinId) {
        const logs = this.getLogs();
        // Delete ALL logs linking this Rep to this Pin (to be safe for "Correction")
        const newLogs = logs.filter(l => !(l.repId === repId && l.pinId === pinId));
        this._set(this.KEY_LOGS, newLogs);
    }
}
export default Store;

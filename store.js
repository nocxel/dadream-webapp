/**
 * Store.js - Stateful Data Management (Memory Cached)
 * Principles:
 * 1. Load Once (on Login)
 * 2. Read from Memory (Instant)
 * 3. Write to DB -> Update Memory (Safe Write)
 * 4. No Re-fetching whole lists
 */
import { supabase } from './supabaseClient.js';

class Store {
    constructor() {
        this.currentUser = null;

        // Memory Cache
        this.contacts = [];
        this.pins = [];
        this.logs = []; // Optional but good for consistency
    }

    // Called by AuthManager on successful login
    async setCurrentUser(user) {
        this.currentUser = user;
        if (user) {
            await this.loadAllData();
        } else {
            this.clearData();
        }
    }

    clearData() {
        this.contacts = [];
        this.pins = [];
        this.logs = [];
    }

    async loadAllData() {
        if (!this.currentUser) return;

        console.log("📥 [Store] Loading all data from DB...");

        // Strict Isolation: Filter by rep_id
        const myId = this.currentUser.id;

        const [contactsResult, pinsResult, logsResult] = await Promise.all([
            // Contacts
            supabase.from('contacts').select('*').eq('rep_id', myId).order('name', { ascending: true }),
            // Pins (Raw fetch, no join needed if we merge in memory)
            supabase.from('pins').select('*').eq('rep_id', myId).order('created_at', { ascending: false }),
            // Logs (Limit 100 or something? For now fetch all)
            supabase.from('logs').select('*, pins(title), contacts(name)').eq('rep_id', myId).order('created_at', { ascending: false })
        ]);

        if (contactsResult.error) throw contactsResult.error;
        if (pinsResult.error) throw pinsResult.error;

        this.contacts = contactsResult.data || [];
        // Store raw pins, we will enrich them on read
        this.pins = pinsResult.data || [];
        this.logs = logsResult.data || []; // Logs might need join data preserved

        console.log(`✅ [Store] Loaded: ${this.contacts.length} Contacts, ${this.pins.length} Pins`);
    }

    async checkConnection() {
        const { count, error } = await supabase.from('reps').select('*', { count: 'exact', head: true });
        if (error) {
            console.error("[Store] Connectivity Check Failed:", error);
            return false;
        }
        return true;
    }

    // ===========================
    // Representatives (System Users) - No internal caching needed (Global)
    // ===========================
    async checkWhitelist(email) {
        // ... (Keep existing logic)
        const { data, error } = await supabase
            .from('reps')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Whitelist Check Failed:", error);
            alert("DB Error: " + error.message);
        }
        return error ? null : data;
    }

    async linkUserToRep(email, authId) {
        const { data, error } = await supabase
            .from('reps')
            .update({ auth_id: authId })
            .eq('email', email)
            .select().single();
        if (error) throw error;
        return data;
    }

    // ===========================
    // Contacts (Clients) - Stateful
    // ===========================
    getContacts() {
        // 0-second Read
        return this.contacts;
    }

    getContact(id) {
        // Memory Lookup
        return this.contacts.find(c => c.id === id) || null;
    }

    async addContact(name, phone) {
        // 1. DB Request
        if (!this.currentUser) throw new Error("로그인 필요");

        const formattedPhone = this._formatPhone(phone);
        const newContact = {
            name,
            phone: formattedPhone,
            rep_id: this.currentUser.id
        };

        const { data, error } = await supabase
            .from('contacts')
            .insert(newContact)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new Error(`이미 등록된 번호입니다: ${formattedPhone}`);
            throw error;
        }

        // 2. Memory Update (Safe Write)
        this.contacts.push(data);
        // Sort explicitly if needed, or just append
        this.contacts.sort((a, b) => a.name.localeCompare(b.name));

        return data;
    }

    async updateContact(id, newName, newPhone) {
        const updates = {};
        if (newName) updates.name = newName;
        if (newPhone) updates.phone = this._formatPhone(newPhone);

        // Duplicate check logic (omitted for brevity, assume DB constraint or simple check?)
        // The user asked for clean logic. I will trust DB constraint for duplicate phone mostly,
        // but existing logic had a pre-check. I'll re-implement pre-check using MEMORY.

        if (newPhone) {
            const formatted = this._formatPhone(newPhone);
            const duplicate = this.contacts.find(c => c.phone === formatted && c.id !== id);
            if (duplicate) throw new Error(`이미 등록된 번호입니다: ${formatted}`);
        }

        const { data, error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Memory Update
        const index = this.contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            this.contacts[index] = data;
        }

        return data;
    }

    async deleteContact(id) {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;

        // Memory Update
        this.contacts = this.contacts.filter(c => c.id !== id);
        return true;
    }

    // ===========================
    // Pinpoints (Sites) - Stateful
    // ===========================
    getPins() {
        // Enrich data on-the-fly from memory (0s operation)
        return this.pins.map(pin => this._enrichPin(pin));
    }

    getPin(id) {
        const pin = this.pins.find(p => p.id === id);
        return pin ? this._enrichPin(pin) : null;
    }

    // New helper to get active pin by contact
    getContactActivePin(contactId) {
        const pin = this.pins.find(p => p.contact_id === contactId && p.status === 'active');
        return pin ? this._enrichPin(pin) : null;
    }

    async addPin(dataInput) {
        if (!this.currentUser) throw new Error("로그인 필요");

        // Memory Uniqueness Check
        if (this.pins.some(p => p.title === dataInput.title)) {
            throw new Error(`이미 존재하는 현장 이름입니다: ${dataInput.title}`);
        }

        const newPinPayload = {
            title: dataInput.title,
            address: dataInput.address,
            lat: dataInput.lat,
            lng: dataInput.lng,
            contact_id: dataInput.contactId || null,
            rep_id: this.currentUser.id,
            status: dataInput.contactId ? 'active' : 'new',
            photo: dataInput.photo || null,
            notes: dataInput.notes || '',
        };

        const { data, error } = await supabase
            .from('pins')
            .insert(newPinPayload)
            .select()
            .single();

        if (error) throw error;

        // Memory Update
        this.pins.unshift(data); // Add to top

        // Log Logic (Side Effect - Fire and Forget or Await?)
        if (data.contact_id) {
            this.logActivity(data.contact_id, data.id, data.title);
        }

        return this._enrichPin(data);
    }

    async updatePin(id, updates) {
        const dbUpdates = {};
        if (updates.title) dbUpdates.title = updates.title;
        if (updates.address) dbUpdates.address = updates.address;
        if (updates.lat) dbUpdates.lat = updates.lat;
        if (updates.lng) dbUpdates.lng = updates.lng;
        if (updates.photo !== undefined) dbUpdates.photo = updates.photo;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.contactId !== undefined) dbUpdates.contact_id = updates.contactId;
        if (updates.status) dbUpdates.status = updates.status;

        const { data, error } = await supabase
            .from('pins')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Memory Update
        const index = this.pins.findIndex(p => p.id === id);
        if (index !== -1) {
            this.pins[index] = data;
        }

        return this._enrichPin(data);
    }

    async deletePin(id) {
        const { error } = await supabase.from('pins').delete().eq('id', id);
        if (error) return false;

        this.pins = this.pins.filter(p => p.id !== id);
        return true;
    }

    async assignContact(pinId, contactId) {
        const { data, error } = await supabase
            .from('pins')
            .update({ contact_id: contactId, status: 'active' })
            .eq('id', pinId)
            .select()
            .single();

        if (error) throw error;

        // Memory Update
        const index = this.pins.findIndex(p => p.id === pinId);
        if (index !== -1) this.pins[index] = data;

        await this.logActivity(contactId, pinId, data.title);
        return this._enrichPin(data);
    }

    async unassignContact(pinId) {
        const oldPin = this.pins.find(p => p.id === pinId);
        const oldContactId = oldPin ? oldPin.contact_id : null;

        const { data, error } = await supabase
            .from('pins')
            .update({ contact_id: null, status: 'new' })
            .eq('id', pinId)
            .select()
            .single();

        if (error) throw error;

        // Memory Update
        const index = this.pins.findIndex(p => p.id === pinId);
        if (index !== -1) this.pins[index] = data;

        return { pin: this._enrichPin(data), oldContactId };
    }

    // ===========================
    // Activity Logs
    // ===========================
    async getLogs(repId = null) {
        // Return memory logs, ignore repId arg since we strictly use this.logs (my pocket)
        return this.logs.map(log => ({
            id: log.id,
            contactId: log.contact_id,
            pinId: log.pin_id,
            repId: log.rep_id,
            date: log.created_at || log.timestamp || new Date().toISOString(),
            // Join in memory from this.pins/contacts if possible, OR rely on what we fetched
            // The initial fetch included joins. 
            // BUT newly added logs need enrichment.
            // Let's manually enrich for consistency.
            projectName: this.pins.find(p => p.id === log.pin_id)?.title || log.pins?.title || '현장명 없음',
            contactName: this.contacts.find(c => c.id === log.contact_id)?.name || log.contacts?.name || '알수없음'
        }));
    }

    async logActivity(contactId, pinId, projectName = '') {
        const { data, error } = await supabase
            .from('logs')
            .insert({
                contact_id: contactId,
                pin_id: pinId,
                rep_id: this.currentUser.id
            })
            .select()
            .single(); // We need data to update memory

        if (error) {
            console.error("Log Error", error);
            return;
        }

        // Memory Update
        // We'll just push it. Note that getLogs maps it, so we don't need to fake join here.
        this.logs.unshift(data);
    }

    async getContactLogs(contactId) {
        // Filter from memory
        const logs = this.logs.filter(l => l.contact_id === contactId);
        // Enrich
        return logs.map(log => {
            const pin = this.pins.find(p => p.id === log.pin_id);
            return {
                id: log.id,
                contactId: log.contact_id,
                pinId: log.pin_id,
                date: log.created_at,
                projectName: pin?.title || '현장명 없음',
                notes: pin?.notes,
                lat: pin?.lat,
                lng: pin?.lng
            };
        });
    }

    async deleteLog(id) {
        const { error } = await supabase.from('logs').delete().eq('id', id);
        if (error) throw error;
        this.logs = this.logs.filter(l => l.id !== id);
        return true;
    }


    // ===========================
    // Helpers
    // ===========================
    _enrichPin(dbPin) {
        if (!dbPin) return null;
        const contact = this.contacts.find(c => c.id === dbPin.contact_id);

        return {
            id: dbPin.id,
            title: dbPin.title,
            address: dbPin.address,
            lat: dbPin.lat,
            lng: dbPin.lng,
            contactId: dbPin.contact_id,
            contactName: contact ? contact.name : null,
            contactPhone: contact ? contact.phone : '',
            status: dbPin.status,
            photo: dbPin.photo,
            notes: dbPin.notes,
            createdAt: dbPin.created_at
        };
    }

    _formatPhone(phone) {
        if (!phone) return '';
        const num = phone.replace(/\D/g, '');
        if (num.length === 11) return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
        if (num.length === 10) {
            if (num.startsWith('02')) return `${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6, 10)}`;
            return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6, 10)}`;
        }
        return num;
    }
}

export default Store;

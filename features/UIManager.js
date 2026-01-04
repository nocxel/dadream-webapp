export default class UIManager {
    constructor() {
        this.overlay = document.getElementById('modalOverlay');

        // Event Delegation for Close Buttons (Dynamic Content)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.closest('.close-btn')) {
                this.closeAllModals();
            }
        });
    }

    closeAllModals() {
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            // Check all known modals or use generic class
            document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));
        }, 300);
    }

    showToast(msg) {
        const div = document.createElement('div');
        div.className = 'glass-panel';
        Object.assign(div.style, {
            position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
            padding: '12px 24px', borderRadius: '30px', color: '#333', backgroundColor: 'white',
            fontWeight: 'bold', zIndex: '3000', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        });
        div.innerHTML = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            this.overlay.classList.remove('hidden');
            setTimeout(() => this.overlay.classList.add('active'), 10);

            // Hide others first
            document.querySelectorAll('.modal-card').forEach(m => m.classList.add('hidden'));

            modal.classList.remove('hidden');
        }
    }
}

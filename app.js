import Store from './store.js';
import MapRenderer from './map_renderer.js';
import UIManager from './features/UIManager.js';
import LayoutManager from './src/components/Layout/LayoutManager.js';
import RepManager from './src/components/Contact/RepManager.js';
import PinManager from './src/components/Pin/PinManager.js';
import SearchManager from './src/components/Search/SearchManager.js';
import AdminManager from './src/components/Admin/AdminManager.js';
import ContactManager from './src/components/Contact/ContactManager.js';
import AuthManager from './src/components/Auth/AuthManager.js';

class App {
    constructor() {
        this.layoutManager = new LayoutManager(); // Init Layout First

        this.store = new Store();
        this.ui = new UIManager();
        this.mapRenderer = new MapRenderer('map');

        // Feature Managers
        this.authManager = new AuthManager(this.store); // Init Auth First
        this.repManager = new RepManager(this.store, this.ui);
        this.pinManager = new PinManager(this.store, this.mapRenderer, this.ui);
        this.searchManager = new SearchManager(this.store, this.mapRenderer, this.ui);
        this.adminManager = new AdminManager(this.store, this.ui);
        this.contactManager = new ContactManager(this.store, this.ui);

        this.init();
    }

    async init() {
        // Managers usually init themselves in constructor or explicitly here
        // AuthManager inits in constructor (binds events)
        this.searchManager.init();
        this.contactManager.init();
    }
}

// Start App
const app = new App();
window.app = app;

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });

    // Handle PWA Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;

        // Show your own UI to notify the user they can add to home screen
        // Create a custom install button if it doesn't exist
        if (!document.getElementById('pwaInstallBtn')) {
            const btn = document.createElement('button');
            btn.id = 'pwaInstallBtn';
            btn.textContent = '앱 설치하기';
            btn.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999;
                background: #333;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 50px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-weight: bold;
                cursor: pointer;
            `;

            btn.addEventListener('click', () => {
                // Hide our user interface that shows our A2HS button
                btn.style.display = 'none';
                // Show the prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the A2HS prompt');
                    } else {
                        console.log('User dismissed the A2HS prompt');
                    }
                    deferredPrompt = null;
                });
            });

            document.body.appendChild(btn);
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed');
        const btn = document.getElementById('pwaInstallBtn');
        if (btn) btn.style.display = 'none';
    });
}

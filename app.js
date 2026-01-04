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

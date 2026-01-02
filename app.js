/**
 * app.js - Main Application Entry Point
 * Refactored into Feature Modules
 */
import Store from './store.js';
import MapRenderer from './map_renderer.js';
import UIManager from './features/UIManager.js';
import RepManager from './features/RepManager.js';
import PinManager from './features/PinManager.js';
import SearchManager from './features/SearchManager.js';
import AdminManager from './features/AdminManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Services
    const store = new Store();
    const mapRenderer = new MapRenderer('map');
    const ui = new UIManager();

    // 2. Feature Managers
    const repManager = new RepManager(store, ui);
    const pinManager = new PinManager(store, mapRenderer, ui);
    const searchManager = new SearchManager(store, mapRenderer, ui);
    const adminManager = new AdminManager(store, ui);

    console.log("Application Initialized");
});

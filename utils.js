/**
 * Utils.js - Helper functions
 */

const Utils = {
    // Generate UUID
    uuid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    // Date Format YYYY-MM-DD
    formatDate(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleDateString('ko-KR');
    },

    // Compress Image
    compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
};

export default Utils;

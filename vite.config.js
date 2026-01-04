import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
    plugins: [
        basicSsl()
    ],
    server: {
        host: true, // 0.0.0.0
        https: true
    }
})

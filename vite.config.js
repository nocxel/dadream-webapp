import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
    plugins: [
        basicSsl()
    ],
    server: {
        host: true, // Exposes server to network (0.0.0.0)
        https: true // Enables HTTPS
    }
})

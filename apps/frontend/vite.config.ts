import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      manifest: {
        name: 'MoneyAPP',
        short_name: 'MoneyAPP',
        theme_color: '#f3f4ee',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/',
        icons: [
          // Ícone instalado = quadrado opaco (moeda sobre #121212): o PNG transparente virava quadrado branco no Mac/iOS
          { src: '/logo/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        }
      }
    }
  },
  server: {
    port: 5173,
    // Em container, `--host` sozinho nao basta: o Vite recusa Host que nao seja
    // localhost e responde "Blocked request". O acesso em dev vem da LAN ou do
    // Tailscale, entao os dois precisam estar ligados.
    host: true,
    allowedHosts: true,
    // Em producao o nginx do proprio front encaminha /api ao backend; em dev
    // nao ha nginx. Rodando na maquina o alvo e localhost, rodando em container
    // e o alias do backend na awl_network — dai a variavel, definida no
    // docker-compose.dev.yml.
    proxy: { '/api': process.env.DEV_API_TARGET || 'http://localhost:3000' },
  },
});

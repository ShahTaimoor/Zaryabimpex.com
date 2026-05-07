import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Smart Business POS',
        short_name: 'Smart Business POS',
        description: 'Wholesale & Retail POS System with Offline Support',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-ws-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-ws-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-ws-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Smaller SW install: skip precaching the largest lazy vendor bundles (network-first fetch still caches in HTTP cache).
        globIgnores: [
          '**/vendor-pdf-*.js',
          '**/vendor-qr-*.js',
          '**/vendor-charts-*.js',
          '**/vendor-editor-*.js',
        ],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  build: {
    // Production: esbuild minifies JS by default; audit with Lighthouse on `vite preview` / nginx, not `vite dev`.
    minify: 'esbuild',
    cssMinify: true,
    target: 'es2020',
    // `vite build` emits hashed filenames under dist/assets/ — cache-immutable in nginx/CDN.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          /** First scoped package segment after node_modules (e.g. react, @radix-ui/react-slot). */
          const tail = id.split(/[/\\]node_modules[/\\]/).pop() || '';
          const scoped = tail.startsWith('@');
          const pkg = scoped ? `${tail.split('/')[0]}/${tail.split('/')[1]}` : tail.split('/')[0];

          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') return 'vendor-react';
          if (pkg === 'react-router' || pkg === 'react-router-dom') return 'vendor-router';
          if (pkg === '@reduxjs/toolkit' || pkg === 'react-redux' || pkg === 'redux' || pkg === 'redux-thunk')
            return 'vendor-redux';
          if (pkg === 'recharts') return 'vendor-charts';
          if (pkg === 'jspdf' || pkg === 'jspdf-autotable') return 'vendor-pdf';
          if (pkg === 'react-quill' || pkg === 'quill') return 'vendor-editor';
          if (pkg === 'lucide-react') return 'vendor-icons';
          if (pkg === 'date-fns' || pkg === '@date-fns/tz') return 'vendor-dates';
          if (pkg === 'html5-qrcode') return 'vendor-qr';
          if (pkg === 'dexie') return 'vendor-dexie';
          if (pkg.startsWith('i18next') || pkg === 'react-i18next') return 'vendor-i18n';
          if (pkg.startsWith('@radix-ui')) return 'vendor-radix';
          if (pkg.startsWith('@headlessui')) return 'vendor-headless';
          if (pkg === '@tanstack/react-virtual') return 'vendor-virtual';
          if (pkg === 'react-hook-form' || pkg === '@hookform/resolvers' || pkg === 'zod') return 'vendor-forms';
          if (pkg === 'react-select') return 'vendor-select';
          if (pkg === 'axios') return 'vendor-http';
          if (pkg === 'react-query' || pkg === '@tanstack/query-core') return 'vendor-query';
          if (pkg === 'sonner' || pkg === 'react-hot-toast') return 'vendor-toast';
          if (pkg.startsWith('@emotion')) return 'vendor-emotion';
          if (pkg.startsWith('@floating-ui')) return 'vendor-floating-ui';
          if (pkg === 'immer' || pkg === 'reselect') return 'vendor-redux';
          if (pkg === 'motion' || pkg.startsWith('@motionone')) return 'vendor-motion';
          if (pkg === 'jsbarcode') return 'vendor-barcode';
          if (pkg === 'react-responsive') return 'vendor-responsive';
          if (pkg === 'react-to-print') return 'vendor-print';
          if (pkg === 'react-day-picker') return 'vendor-calendar';
          if (pkg === 'react-helmet-async') return 'vendor-helmet';
          if (pkg === '@babel/runtime') return 'vendor-babel-runtime';
          if (pkg === 'dom-helpers') return 'vendor-dom-helpers';
          if (pkg === 'react-is' || pkg === 'prop-types' || pkg === 'hoist-non-react-statics')
            return 'vendor-react-aux';
          if (pkg.startsWith('rc-')) return 'vendor-rc';
          if (pkg.startsWith('d3-') || pkg === 'd3-array' || pkg === 'd3-shape') return 'vendor-d3';
          if (pkg === 'eventemitter3') return 'vendor-eventemitter';
          if (pkg === 'use-sync-external-store') return 'vendor-react';
          if (pkg === 'clsx' || pkg === 'classnames' || pkg === 'class-variance-authority' || pkg === 'tailwind-merge')
            return 'vendor-tiny';
          return 'vendor-misc';
        },
      },
    },
    /** After extra manualChunks; raise if a single aggregate still exceeds this. */
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    // Adjust proxy target/path as needed for your backend
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});


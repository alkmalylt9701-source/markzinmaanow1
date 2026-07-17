PWA setup instructions

Files added:
- public/manifest.json
- public/service-worker.js
- src/registerServiceWorker.ts

What you need to do next:

1) Icons
   - Put your app icons at: public/icons/icon-192.png and public/icons/icon-512.png
   - These are referenced by the manifest and used when installing to home screen.

2) index.html changes
   - Add the manifest link and meta tags to your index.html <head>:
     <link rel="manifest" href="/manifest.json" />
     <meta name="theme-color" content="#0f172a" />
     <meta name="apple-mobile-web-app-capable" content="yes" />
     <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
     <link rel="apple-touch-icon" href="/icons/icon-192.png" />

3) Register the service worker
   - Import and call registerServiceWorker() from your main entry file (e.g. src/main.tsx or src/main.jsx) once, for example:
     import { registerServiceWorker } from '@/registerServiceWorker';
     registerServiceWorker();

4) Serve over HTTPS
   - PWA install prompt and service workers require HTTPS. Use Vercel/Netlify/GitHub Pages or serve locally with a TLS server.

5) Supabase settings (if using magic links)
   - Make sure Supabase Auth Site URL / Redirect URLs include your app origin (e.g. https://your-app.netlify.app)

6) Test
   - Build and preview (npm run build && npm run preview) on a machine with HTTPS or deploy and open the site on your phone.
   - On Android (Chrome) you should see "Add to Home screen" prompt, or use the browser menu -> Add to Home screen.
   - On iOS (Safari) use Share -> Add to Home Screen (note: SW support on iOS is limited).

If you want, I can also add a simple splash screen and icons generation steps or create a small script to help produce icons from a single SVG.

# Arcus — Deployment Guide

This folder contains all files needed for production deployment.

```
arcus-deploy/
├── backend/         → Deploy to Render (Node.js API)
└── landing/         → Deploy to Vercel (APK download website)
```

---

## 1. Deploy Backend to Render

1. Go to https://render.com → New → Web Service
2. Connect this `backend/` folder as your repo root
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Environment Variables:** See `backend/.env.example`

---

## 2. Deploy Landing Page to Vercel

1. Go to https://vercel.com → New Project
2. Connect this `landing/` folder as your repo root
3. No build step needed — it's pure HTML/CSS/JS
4. Drop your APK file in `landing/public/` and update the download link

---

## 3. Upload APK for Download

- Place your signed APK file inside `landing/public/arcus-latest.apk`
- Or host it on Google Drive and update the download link in `landing/index.html`

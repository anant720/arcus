# Arcus Backend — Render Deployment

## Setup

1. Push this `backend/` directory to a GitHub repo
2. On Render → New Web Service → connect repo
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Node version:** 18+

## Required Environment Variables on Render Dashboard

```
PORT=10000
FRONTEND_ORIGIN=https://your-landing.vercel.app
JWT_ACCESS_SECRET=<generate with: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 64>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BREVO_API_KEY=your-brevo-api-key
OTP_TTL_SECONDS=300
```

> NOTE: Render sets PORT automatically. The app reads `process.env.PORT`.
> Do NOT commit your actual `.env` file to GitHub.

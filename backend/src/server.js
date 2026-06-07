import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import facultyRoutes from './routes/faculty.routes.js';
import hubRoutes from './routes/hub.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import profileRoutes from './routes/profile.routes.js';
import otaRoutes from './routes/ota.routes.js';

const app = express();

// ── CORS first — must be before Helmet so preflight OPTIONS gets correct headers ──
const allowedOrigins = [
  env.frontendOrigin,
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'http://192.168.1.19:5173',
  'http://192.168.31.73:5173',
  'http://192.168.31.73',
  'https://arcus-yz6a.onrender.com',
  'https://arcus-topaz.vercel.app',
  null, // allow direct APK requests with no Origin header
];

app.use(
  cors({
    origin: function(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Security Headers ──
// crossOriginResourcePolicy: cross-origin — allows browser fetch from a different port (localhost:5173 → 8080)
// crossOriginOpenerPolicy: false — Firebase Google popup auth REQUIRES this; enabling it breaks signInWithPopup
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
  }),
);


// ── Body / Cookie parsers ──
app.use(express.json({
  limit: '50kb',
  // Explicitly handle payload too large with a clean 413 JSON response
  strict: true,
}));
app.use(cookieParser());

// ── Handle payload too large (must be BEFORE routes) ──
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large. Maximum allowed size is 50KB.' });
  }
  next(err);
});

// ── Global rate limiter: 200 req / 15 min per IP ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);

// ── Auth routes get a tighter limiter to stop brute-force ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,           // max 20 login/signup attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please wait 15 minutes.' },
});

// ── OTP endpoint gets the tightest limit (abuse prevention) ──
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // only 5 OTP requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait before trying again.' },
});

// ── Routes ──
app.use('/api/health', healthRoutes);
app.use('/api/auth/email/request-otp', otpLimiter);  // tightest — OTP spam
app.use('/api/auth', authLimiter, authRoutes);        // auth brute force
app.use('/api/faculty', facultyRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ota', otaRoutes);

// ── Serve OTA Static Files ──
import path from 'path';
app.use('/updates', express.static(path.join(process.cwd(), 'updates')));

// ── Global error handler (never leak stack traces to the client) ──
app.use((error, _req, res, _next) => {
  console.error('[SERVER ERROR]', error.message);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Backend API running on http://localhost:${env.port}`);
});

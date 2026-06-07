import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { auth as firebaseAuth, db } from '../config/firebaseAdmin.js';
import {
  createRefreshSession,
  revokeRefreshSession,
  rotateRefreshToken,
  signAccessToken,
} from '../services/session.service.js';
import { sendOtpEmail } from '../services/mail.service.js';
import env from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

const USERS = 'users';
const CREDENTIALS = 'user_credentials';
const OTP_REQUESTS = 'email_otp_requests';

function setSessionCookies(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    // Set secure:true in production (HTTPS). Keep false only for local dev.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function getCredentialByEmail(email) {
  const query = await db
    .collection(CREDENTIALS)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  if (query.empty) return null;
  return query.docs[0].data();
}

async function getUserByEmail(email) {
  const query = await db
    .collection(USERS)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
  if (query.empty) return null;
  return query.docs[0].data();
}

async function ensureUserProfileDoc({ uid, email, displayName = '', photoURL = '' }) {
  const ref = db.collection(USERS).doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return snap.data();
  }

  const profile = {
    uid,
    email,
    displayName,
    photoURL,
    role: 'student',
    isAdmin: false,
    department: '',
    course: '',
    year: null,
    enrollment: '',
    roll: '',
    language: 'en',
    theme: 'light',
    notifications: true,
    isComplete: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await ref.set(profile);
  return profile;
}

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const googleUid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();
    const displayName = decoded.name || '';
    const photoURL = decoded.picture || '';

    let profile;
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      // Merge with existing account
      profile = await ensureUserProfileDoc({ uid: existingUser.uid, email, displayName, photoURL });
    } else {
      // Create new account
      profile = await ensureUserProfileDoc({ uid: googleUid, email, displayName, photoURL });
    }

    const accessToken = signAccessToken({ uid: profile.uid, email, role: profile.role || 'student' });
    const { refreshToken } = await createRefreshSession({ uid: profile.uid, email, provider: 'google' });
    setSessionCookies(res, refreshToken);

    return res.json({ accessToken, user: profile });
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Invalid Google token' });
  }
});

router.post('/email/request-otp', async (req, res) => {
  try {
    const { email, password, displayName = '' } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    // Prevent bcrypt DoS — bcrypt silently truncates at 72 chars anyway
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password is too long.' });
    }
    // Sanitize displayName
    const safeName = String(displayName).trim().slice(0, 80);

    const exists = await getUserByEmail(email);
    if (exists) {
      return res.status(409).json({ message: 'This email is already registered. Please log in.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const passwordHash = await bcrypt.hash(password, 12);
    const expiresAt = Date.now() + env.otpTtlSeconds * 1000;

    await db.collection(OTP_REQUESTS).doc(email.toLowerCase()).set({
      email: email.toLowerCase(),
      displayName: safeName,
      passwordHash,
      otpHash,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });

    await sendOtpEmail({ toEmail: email.toLowerCase(), otp });
    return res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send OTP' });
  }
});

router.post('/email/verify-signup', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'email and otp are required' });

    // Basic email format guard
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Strip non-digits (prevents padding attacks)
    const cleanOtp = String(otp).replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      return res.status(400).json({ message: 'OTP must be 6 digits.' });
    }

    const otpRef = db.collection(OTP_REQUESTS).doc(email.toLowerCase());
    const otpDoc = await otpRef.get();
    if (!otpDoc.exists) return res.status(400).json({ message: 'No OTP request found.' });
    const pending = otpDoc.data();

    if (Date.now() > pending.expiresAt) {
      await otpRef.delete();
      return res.status(400).json({ message: 'OTP expired. Request a new code.' });
    }

    // Brute-force protection: max 5 attempts
    const attempts = (pending.attempts || 0) + 1;
    if (attempts > 5) {
      await otpRef.delete();
      return res.status(429).json({ message: 'Too many wrong attempts. Request a new OTP.' });
    }

    const isValidOtp = await bcrypt.compare(cleanOtp, pending.otpHash);
    if (!isValidOtp) {
      await otpRef.update({ attempts });
      return res.status(400).json({ message: `Invalid OTP code. ${5 - attempts + 1} attempt(s) remaining.` });
    }

    const uid = uuidv4();
    await db.collection(CREDENTIALS).doc(uid).set({
      uid,
      email: email.toLowerCase(),
      passwordHash: pending.passwordHash,
      provider: 'email',
      createdAt: new Date().toISOString(),
    });

    const profile = await ensureUserProfileDoc({
      uid,
      email: email.toLowerCase(),
      displayName: pending.displayName || '',
      photoURL: '',
    });

    await otpRef.delete();

    const accessToken = signAccessToken({ uid, email: profile.email, role: profile.role || 'student' });
    const { refreshToken } = await createRefreshSession({ uid, email: profile.email, provider: 'email' });
    setSessionCookies(res, refreshToken);

    return res.json({ accessToken, user: profile });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify signup OTP' });
  }
});

router.post('/email/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password are required' });

    const credential = await getCredentialByEmail(email);
    if (!credential) return res.status(401).json({ message: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, credential.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

    const profile = await ensureUserProfileDoc({
      uid: credential.uid,
      email: credential.email,
      displayName: '',
      photoURL: '',
    });

    const accessToken = signAccessToken({
      uid: credential.uid,
      email: credential.email,
      role: profile.role || 'student',
    });
    const { refreshToken } = await createRefreshSession({
      uid: credential.uid,
      email: credential.email,
      provider: 'email',
    });
    setSessionCookies(res, refreshToken);

    return res.json({ accessToken, user: profile });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Missing refresh token' });

    const rotated = await rotateRefreshToken(refreshToken);
    const sessionDoc = await db.collection('sessions').doc(rotated.sessionId).get();
    const uid = sessionDoc.data().uid;
    const profile = await db.collection(USERS).doc(uid).get();

    const accessToken = signAccessToken({
      uid,
      email: profile.data().email,
      role: profile.data().role || 'student',
    });
    setSessionCookies(res, rotated.refreshToken);

    return res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profileSnap = await db.collection(USERS).doc(req.user.uid).get();
    if (!profileSnap.exists) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    const profile = profileSnap.data();
    return res.json({ user: profile });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load current user' });
  }
});

router.post('/set-password', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password is too long.' });
    }

    const uid = req.user.uid;
    const email = req.user.email;

    const existing = await getCredentialByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Password is already set.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    await db.collection(CREDENTIALS).doc(uid).set({
      uid,
      email: email.toLowerCase(),
      passwordHash,
      provider: 'email',
      createdAt: new Date().toISOString(),
    });

    return res.json({ message: 'Password set successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to set password' });
  }
});

router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) await revokeRefreshSession(refreshToken);
  res.clearCookie('refreshToken');
  return res.json({ message: 'Logged out successfully' });
});

export default router;

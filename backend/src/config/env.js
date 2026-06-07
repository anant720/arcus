import dotenv from 'dotenv';

dotenv.config();

function readEnv(key, required = true) {
  const value = process.env[key];
  if (required && (!value || value.trim() === '')) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 8080),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  jwtAccessSecret: readEnv('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: readEnv('JWT_REFRESH_SECRET'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '30d',
  firebaseProjectId: readEnv('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: readEnv('FIREBASE_CLIENT_EMAIL'),
  firebasePrivateKey: readEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSenderEmail: process.env.BREVO_ACCOUNT_EMAIL || '',
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
};

export default env;

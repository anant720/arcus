import SibApiV3Sdk from 'sib-api-v3-sdk';
import env from '../config/env.js';

let transactionalApi = null;

if (env.brevoApiKey) {
  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications['api-key'];
  apiKey.apiKey = env.brevoApiKey;
  transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();
}

export async function sendOtpEmail({ toEmail, otp }) {
  if (!transactionalApi) {
    throw new Error('Brevo API key is not configured on backend.');
  }

  await transactionalApi.sendTransacEmail({
    sender: { email: env.brevoSenderEmail || toEmail, name: 'MIT ADT Student Hub' },
    to: [{ email: toEmail }],
    subject: 'Your MIT ADT Hub verification code',
    htmlContent: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Your verification code</h2>
        <p>Use this 6-digit code to complete sign up:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in ${Math.floor(env.otpTtlSeconds / 60)} minutes.</p>
      </div>
    `,
  });
}

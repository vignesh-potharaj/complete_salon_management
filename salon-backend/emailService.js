const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  connectionTimeout: 4000, // 4 seconds connection timeout
  greetingTimeout: 4000,   // 4 seconds greeting timeout
  socketTimeout: 4000      // 4 seconds socket inactivity timeout
});

// Verify connection on startup
transporter.verify().then(() => {
  console.log('📧 Email service ready');
}).catch(err => {
  console.error('📧 Email service error (SMTP port likely blocked by cloud provider e.g. Render):', err.message);
  console.log('💡 Note: Registration/reset verification codes will fallback to console logs.');
});

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send email verification code
 */
async function sendVerificationCode(email, code, salonName) {
  const mailOptions = {
    from: `"SalonPro" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '✂ SalonPro — Verify Your Email',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Email Verification for <strong>${salonName}</strong></p>
        <div style="background:#f8f8f8; border-radius:10px; padding:24px; text-align:center; margin-bottom:24px;">
          <p style="margin:0 0 8px; color:#888; font-size:13px;">Your verification code is</p>
          <div style="font-size:36px; font-weight:bold; letter-spacing:8px; color:#111;">${code}</div>
        </div>
        <p style="color:#999; font-size:12px; margin:0;">This code expires in <strong>10 minutes</strong>. If you didn't create a SalonPro account, ignore this email.</p>
      </div>
    `
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send verification email to ${email}. Connection timed out or blocked.`);
    console.log(`🔑 [FALLBACK LOG] Verification Code for ${email} (${salonName}): ${code}`);
    throw err;
  }
}

/**
 * Send password reset code
 */
async function sendPasswordResetCode(email, code, userName) {
  const mailOptions = {
    from: `"SalonPro" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🔑 SalonPro — Password Reset Code',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Password reset request for <strong>${userName}</strong></p>
        <div style="background:#f8f8f8; border-radius:10px; padding:24px; text-align:center; margin-bottom:24px;">
          <p style="margin:0 0 8px; color:#888; font-size:13px;">Your reset code is</p>
          <div style="font-size:36px; font-weight:bold; letter-spacing:8px; color:#111;">${code}</div>
        </div>
        <p style="color:#999; font-size:12px; margin:0;">This code expires in <strong>10 minutes</strong>. If you didn't request this, your account is safe — no action needed.</p>
      </div>
    `
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send password reset email to ${email}. Connection timed out or blocked.`);
    console.log(`🔑 [FALLBACK LOG] Password Reset Code for ${email} (${userName}): ${code}`);
    throw err;
  }
}

module.exports = { generateOTP, sendVerificationCode, sendPasswordResetCode };

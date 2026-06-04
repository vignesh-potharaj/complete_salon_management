const nodemailer = require('nodemailer');
const axios = require('axios');

// Build transport options dynamically to allow custom SMTP configuration (essential for cloud deployments like Render)
const transportOpts = {
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000
};

if (process.env.SMTP_HOST) {
  transportOpts.host = process.env.SMTP_HOST;
  transportOpts.port = parseInt(process.env.SMTP_PORT) || 587;
  transportOpts.secure = process.env.SMTP_SECURE === 'true' || transportOpts.port === 465;
  transportOpts.auth = {
    user: process.env.SMTP_USER || process.env.GMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
  };
  transportOpts.tls = {
    rejectUnauthorized: false
  };
} else {
  transportOpts.service = 'gmail';
  transportOpts.auth = {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  };
}

const transporter = nodemailer.createTransport(transportOpts);
const fromEmail = process.env.SMTP_USER || process.env.GMAIL_USER;

const rawKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;
const brevoApiKey = rawKey ? rawKey.replace(/['"]/g, '').trim() : null;
const isBrevoKey = brevoApiKey && (brevoApiKey.startsWith('xkeysib-') || brevoApiKey.startsWith('xsmtpsib-'));

if (isBrevoKey) {
  console.log('📧 Email service: Brevo HTTP API active (immune to SMTP port blocks)');
} else {
  // Verify connection on startup
  transporter.verify().then(() => {
    console.log('📧 Email service ready');
  }).catch(err => {
    console.error('📧 Email service error:', err.message);
    console.log('💡 Note: Registration/reset verification codes will fallback to console logs if connection is blocked.');
  });
}

/**
 * sendMailWrapper wraps SMTP and HTTP API sending dynamically.
 */
async function sendMailWrapper(mailOptions) {
  if (isBrevoKey) {
    const senderEmail = fromEmail || 'salonpro.noreply@gmail.com';
    try {
      const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: 'SalonPro', email: senderEmail },
        to: [{ email: mailOptions.to }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html
      }, {
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        }
      });
      return response.data;
    } catch (apiErr) {
      const errMsg = apiErr.response ? JSON.stringify(apiErr.response.data) : apiErr.message;
      console.error('📧 Brevo HTTP API Error:', errMsg);
      if (brevoApiKey) {
        console.log(`🔧 Debug Key Info - Length: ${brevoApiKey.length}, Start: ${brevoApiKey.substring(0, 12)}..., End: ...${brevoApiKey.substring(brevoApiKey.length - 4)}`);
      }
      throw new Error(errMsg);
    }
  }

  return await transporter.sendMail(mailOptions);
}

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
    from: `"SalonPro" <${fromEmail}>`,
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
    return await sendMailWrapper(mailOptions);
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
    from: `"SalonPro" <${fromEmail}>`,
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
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send password reset email to ${email}. Connection timed out or blocked.`);
    console.log(`🔑 [FALLBACK LOG] Password Reset Code for ${email} (${userName}): ${code}`);
    throw err;
  }
}


/**
 * Send subscription activated email
 */
async function sendSubscriptionActivated(user, plan, endDate) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: 'Your SalonPro subscription is now active 🎉',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <div style="background:#f8f8f8; border-radius:10px; padding:24px; margin-bottom:24px;">
          <p style="margin:0 0 8px; color:#333; font-size:16px;"><strong>Subscription Activated!</strong></p>
          <p style="margin:4px 0; color:#555; font-size:14px;">Plan: <strong style="text-transform:uppercase;">${plan}</strong></p>
          <p style="margin:4px 0; color:#555; font-size:14px;">Expires on: <strong>${new Date(endDate).toLocaleDateString()}</strong></p>
        </div>
        <p style="color:#666; font-size:14px; margin:0 0 16px;">Thank you for partnering with SalonPro. Your system is fully active and ready to grow your business.</p>
        <p style="color:#999; font-size:12px; margin:0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send activation email to ${user.email}. Connection timed out or blocked.`);
    console.log(`🔑 [FALLBACK LOG] Subscription Activated for ${user.email} (${user.salonName}): Plan: ${plan}, End Date: ${endDate}`);
    return null; // Return null so backend can continue
  }
}

/**
 * Send subscription expiring email
 */
async function sendSubscriptionExpiring(user, daysLeft, renewalLink) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: `Your SalonPro subscription expires in ${daysLeft} days`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <div style="background:#fffbeb; border-radius:10px; padding:24px; margin-bottom:24px; border:1px solid #fef3c7;">
          <p style="margin:0 0 8px; color:#b45309; font-size:16px;"><strong>Subscription Expiring Soon</strong></p>
          <p style="margin:4px 0; color:#78350f; font-size:14px;">Your subscription expires in <strong>${daysLeft} days</strong>.</p>
        </div>
        <p style="color:#666; font-size:14px; margin:0 0 24px;">Please renew your subscription to avoid any service interruption for your salon operations.</p>
        ${renewalLink ? `<div style="text-align:center;"><a href="${renewalLink}" style="background:#6366f1; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Renew Subscription</a></div>` : ''}
        <p style="color:#999; font-size:12px; margin:24px 0 0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send expiration warning email to ${user.email}.`);
    console.log(`🔑 [FALLBACK LOG] Subscription Expiring for ${user.email} (${user.salonName}): ${daysLeft} days left. Link: ${renewalLink}`);
    return null;
  }
}

/**
 * Send subscription expired email
 */
async function sendSubscriptionExpired(user, renewalLink) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: 'Your SalonPro subscription has expired',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <div style="background:#fef2f2; border-radius:10px; padding:24px; margin-bottom:24px; border:1px solid #fee2e2;">
          <p style="margin:0 0 8px; color:#991b1b; font-size:16px;"><strong>Subscription Expired</strong></p>
          <p style="margin:4px 0; color:#7f1d1d; font-size:14px;">Your subscription has expired. Access to your salon panel may be limited.</p>
        </div>
        <p style="color:#666; font-size:14px; margin:0 0 24px;">To reactivate your service, please click the button below to complete your payment.</p>
        ${renewalLink ? `<div style="text-align:center;"><a href="${renewalLink}" style="background:#ef4444; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Reactivate Subscription</a></div>` : ''}
        <p style="color:#999; font-size:12px; margin:24px 0 0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send expired email to ${user.email}.`);
    console.log(`🔑 [FALLBACK LOG] Subscription Expired for ${user.email} (${user.salonName}). Link: ${renewalLink}`);
    return null;
  }
}

/**
 * Send subscription terminated email
 */
async function sendSubscriptionTerminated(user, reason) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: 'Your SalonPro account has been suspended',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <div style="background:#fef2f2; border-radius:10px; padding:24px; margin-bottom:24px; border:1px solid #fee2e2;">
          <p style="margin:0 0 8px; color:#991b1b; font-size:16px;"><strong>Account Suspended / Terminated</strong></p>
          <p style="margin:4px 0; color:#7f1d1d; font-size:14px;">Reason: <strong>${reason}</strong></p>
        </div>
        <p style="color:#666; font-size:14px; margin:0 0 16px;">Your access to the SalonPro management system has been suspended. Please contact support if you believe this is an error.</p>
        <p style="color:#999; font-size:12px; margin:0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send termination email to ${user.email}.`);
    console.log(`🔑 [FALLBACK LOG] Subscription Terminated for ${user.email} (${user.salonName}). Reason: ${reason}`);
    return null;
  }
}

/**
 * Send custom notification email
 */
async function sendCustomNotification(user, message) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: 'Important update from SalonPro',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <p style="color:#333; font-size:14px; line-height:1.6; margin:0 0 24px; white-space:pre-wrap;">${message}</p>
        <p style="color:#999; font-size:12px; margin:0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send custom notification email to ${user.email}.`);
    console.log(`🔑 [FALLBACK LOG] Custom Notification for ${user.email} (${user.salonName}): ${message}`);
    return null;
  }
}

/**
 * Send payment failed email
 */
async function sendPaymentFailed(user, amount, retryLink) {
  const mailOptions = {
    from: `"SalonPro" <${fromEmail}>`,
    to: user.email,
    subject: 'SalonPro payment failed — action required',
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:12px; border:1px solid #eee;">
        <h2 style="margin:0 0 8px; color:#111;">✂ SalonPro</h2>
        <p style="color:#666; margin:0 0 24px; font-size:14px;">Hello <strong>${user.name}</strong>,</p>
        <div style="background:#fef2f2; border-radius:10px; padding:24px; margin-bottom:24px; border:1px solid #fee2e2;">
          <p style="margin:0 0 8px; color:#991b1b; font-size:16px;"><strong>Payment Attempt Failed</strong></p>
          <p style="margin:4px 0; color:#7f1d1d; font-size:14px;">Amount: <strong>₹${amount}</strong></p>
        </div>
        <p style="color:#666; font-size:14px; margin:0 0 24px;">An attempt to process your subscription payment failed. Please click below to update details or retry.</p>
        ${retryLink ? `<div style="text-align:center;"><a href="${retryLink}" style="background:#6366f1; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Retry Payment</a></div>` : ''}
        <p style="color:#999; font-size:12px; margin:24px 0 0;">SalonPro Administration Team</p>
      </div>
    `
  };

  try {
    return await sendMailWrapper(mailOptions);
  } catch (err) {
    console.error(`❌ Failed to send payment failed email to ${user.email}.`);
    console.log(`🔑 [FALLBACK LOG] Payment Failed for ${user.email} (${user.salonName}): Amount: ₹${amount}. Link: ${retryLink}`);
    return null;
  }
}

module.exports = {
  generateOTP,
  sendVerificationCode,
  sendPasswordResetCode,
  sendSubscriptionActivated,
  sendSubscriptionExpiring,
  sendSubscriptionExpired,
  sendSubscriptionTerminated,
  sendCustomNotification,
  sendPaymentFailed
};

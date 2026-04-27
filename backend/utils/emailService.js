const nodemailer = require('nodemailer');

let cachedTransporter = null;

const getSmtpConfig = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  return {
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
      : undefined
  };
};

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  const smtp = getSmtpConfig();
  if (!smtp.host) {
    throw new Error('SMTP is not configured');
  }
  cachedTransporter = nodemailer.createTransport(smtp);
  return cachedTransporter;
};

/** RFC 5322 "Name" <addr> — inbox shows Name instead of the mailbox local-part. */
const getFromAddress = () => {
  const fromOverride = (process.env.SMTP_FROM || '').trim();
  if (fromOverride.includes('<') && fromOverride.includes('>')) {
    return fromOverride;
  }
  const email = (fromOverride || process.env.SMTP_USER || 'no-reply@example.com').trim();
  const displayName = (process.env.SMTP_FROM_NAME || '').trim();
  if (displayName && email.includes('@')) {
    const escaped = displayName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}" <${email}>`;
  }
  return email;
};

const sendTwoFactorCodeEmail = async ({ toEmail, code }) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to: toEmail,
    subject: `Your verification code: ${code}`,
    text: `Your verification code: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not attempt to login, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 0 0 16px 0;">${code}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not attempt to login, please ignore this email.</p>
      </div>
    `
  });
};

module.exports = {
  sendTwoFactorCodeEmail
};

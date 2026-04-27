const logger = require('./logger');

const getSmsConfig = () => ({
  apiUrl: (process.env.SMS_API_URL || '').trim(),
  apiKey: (process.env.SMS_API_KEY || '').trim(),
  sender: (process.env.SMS_SENDER || '').trim()
});

const sendTwoFactorCodeSms = async ({ toPhone, code }) => {
  const phone = String(toPhone || '').trim();
  if (!phone) {
    throw new Error('Missing destination mobile number');
  }

  const cfg = getSmsConfig();
  if (!cfg.apiUrl) {
    throw new Error('SMS gateway is not configured');
  }

  const payload = {
    to: phone,
    message: `Your verification code: ${code}. This code expires in 10 minutes.`,
    sender: cfg.sender || undefined
  };

  const response = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const bodyText = await response.text();
    logger.error(`SMS gateway error (${response.status}): ${bodyText}`);
    throw new Error('Failed to send SMS verification code');
  }
};

module.exports = {
  sendTwoFactorCodeSms
};

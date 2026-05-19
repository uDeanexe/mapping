const nodemailer = require('nodemailer');

function getEmailConfig(env) {
  const host = env.SMTP_HOST || '';
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
  const user = env.SMTP_USER || '';
  const pass = env.SMTP_PASS || '';
  const secure = String(env.SMTP_SECURE || '') === '1' || port === 465;
  const from = env.EMAIL_FROM || user || 'no-reply@example.com';
  return { host, port, user, pass, secure, from };
}

function createTransport(env) {
  const cfg = getEmailConfig(env);
  if (!cfg.host || !cfg.user || !cfg.pass) {
    const err = new Error('SMTP belum dikonfigurasi. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS di server/.env');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  return {
    transport: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    }),
    from: cfg.from
  };
}

module.exports = { createTransport };


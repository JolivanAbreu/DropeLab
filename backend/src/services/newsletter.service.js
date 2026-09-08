const { NewsletterSubscriber } = require('../models');
const ApiError = require('../utils/apiError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Assina a newsletter — idempotente: assinar de novo com o mesmo e-mail não
 * dá erro (só reativa, caso a pessoa tivesse cancelado antes).
 */
async function subscribe(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw ApiError.badRequest('Informe um e-mail válido', 'invalid_email');
  }

  const [subscriber] = await NewsletterSubscriber.findOrCreate({
    where: { email: normalized },
    defaults: { email: normalized, active: true },
  });

  if (!subscriber.active) {
    subscriber.active = true;
    await subscriber.save();
  }

  return subscriber;
}

async function listSubscribers() {
  return NewsletterSubscriber.findAll({ where: { active: true }, order: [['createdAt', 'DESC']] });
}

function subscribersToCsv(subscribers) {
  const escape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = ['E-mail,Assinou em'];
  for (const s of subscribers) {
    lines.push([escape(s.email), new Date(s.createdAt).toISOString()].join(','));
  }
  return lines.join('\n');
}

module.exports = { subscribe, listSubscribers, subscribersToCsv };

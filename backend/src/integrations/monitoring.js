const Sentry = require('@sentry/node');

// Sem SENTRY_DSN, vira no-op silencioso.
function isConfigured() {
  return !!process.env.SENTRY_DSN;
}

function initMonitoring() {
  if (!isConfigured()) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}

// Precisa ser chamado depois das rotas e antes do errorHandler final.
function attachExpressErrorHandler(app) {
  if (!isConfigured()) return;
  Sentry.setupExpressErrorHandler(app);
}

function captureException(error, context) {
  if (!isConfigured()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

module.exports = { initMonitoring, attachExpressErrorHandler, captureException, isConfigured };

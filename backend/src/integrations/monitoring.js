const Sentry = require('@sentry/node');

/**
 * Monitoramento de erro em produção. Sem SENTRY_DSN configurado, isso vira
 * um no-op silencioso — nenhuma chamada de rede é feita, nenhum erro
 * acontece por causa da ausência da variável. O objetivo é que o projeto
 * funcione igual com ou sem Sentry configurado; a diferença é só se os
 * erros ficam visíveis num painel ou só no log do servidor.
 */
function isConfigured() {
  return !!process.env.SENTRY_DSN;
}

function initMonitoring() {
  if (!isConfigured()) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Amostragem de performance conservadora por padrão — captura de erro
    // (o que realmente importa aqui) não depende dessa taxa.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}

/**
 * Conecta o Sentry ao Express — precisa ser chamado depois que as rotas da
 * aplicação já foram registradas, e antes do errorHandler final da
 * aplicação (para o Sentry conseguir capturar a exceção antes dela virar
 * uma resposta JSON formatada).
 */
function attachExpressErrorHandler(app) {
  if (!isConfigured()) return;
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Captura manual — usada em pontos onde um erro é tratado (ex.: falha de
 * e-mail, falha do Mercado Pago) mas ainda vale a pena registrar no
 * monitoramento, mesmo sem propagar como uma resposta de erro HTTP.
 */
function captureException(error, context) {
  if (!isConfigured()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

module.exports = { initMonitoring, attachExpressErrorHandler, captureException, isConfigured };

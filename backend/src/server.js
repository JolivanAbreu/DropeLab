require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const { scheduleAbandonedCartJob } = require('./jobs/abandonedCart');
const { scheduleExpireUnpaidPixChargesJob } = require('./jobs/expireUnpaidPixCharges');

const PORT = process.env.PORT || 3000;

// Detecta credenciais ausentes ou ainda com o valor de exemplo do
// .env.example — evita que o primeiro sinal do problema seja um cliente de
// fora da cidade (frete por transportadora) sem conseguir pagar. Não afeta
// pagamento físico (Uber Flash/99/combinar/cartão/dinheiro na entrega),
// que nunca depende do Mercado Pago.
function warnAboutMissingMercadoPagoCredentials() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  const looksLikePlaceholder = (v) => !v || v.includes('xxxxxxxx') || v.includes('TEST-xxx');
  if (looksLikePlaceholder(token)) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[aviso] MERCADOPAGO_ACCESS_TOKEN não parece configurado no .env (ainda com o valor de exemplo, ou vazio).\n' +
      'Pix antecipado (pedidos por transportadora — Correios/Melhor Envio) vai falhar com 502 até você ' +
      'colocar uma credencial real de sandbox, obtida em https://www.mercadopago.com.br/developers/panel — ' +
      'lembre de reiniciar o servidor depois de editar o .env.\n'
    );
  }
}

// Sem STORE_WHATSAPP_NUMBER configurado, o ícone flutuante de WhatsApp e o
// aviso de "combinar frete" somem silenciosamente em toda a loja — o
// comportamento em si está correto (melhor esconder do que mostrar um botão
// quebrado), mas sem esse aviso o motivo fica invisível pra quem não sabe
// que precisa preencher essa variável.
function warnAboutMissingWhatsAppNumber() {
  if (!process.env.STORE_WHATSAPP_NUMBER) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[aviso] STORE_WHATSAPP_NUMBER não está configurado no .env.\n' +
      'O ícone flutuante de WhatsApp e o aviso de "combinar frete com o vendedor" vão ficar ' +
      'invisíveis na loja até você preencher essa variável com o número da loja (só dígitos, ' +
      'com código do país — ex.: 5585999998888) e reiniciar o servidor.\n'
    );
  }
}

// Sem bucket S3/R2 configurado, upload de imagem cai no disco local — ok em
// desenvolvimento, mas as imagens somem a cada novo deploy na maioria dos
// provedores de hospedagem (ver Documento de Plano de Implantação, seção 2.2).
function warnAboutMissingObjectStorage() {
  const storageService = require('./integrations/storage');
  if (!storageService.isObjectStorageConfigured() && process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[aviso] Nenhum bucket S3/R2 configurado (S3_BUCKET, S3_ENDPOINT, etc.) — rodando em produção ' +
      'com upload de imagem em disco local.\n' +
      'Isso normalmente NÃO sobrevive a um novo deploy — as fotos de produto/banner/Instagram podem ' +
      'sumir. Configure um bucket antes de operar com tráfego real (ver .env.example).\n'
    );
  }
}

// Sem SENTRY_DSN configurado, erros em produção só aparecem no log do
// servidor — ninguém é avisado automaticamente quando algo quebra.
function warnAboutMissingMonitoring() {
  if (!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[aviso] SENTRY_DSN não está configurado — rodando em produção sem monitoramento de erro.\n' +
      'Falhas só ficam visíveis no log do servidor; configure um projeto gratuito em ' +
      'https://sentry.io para ser avisado automaticamente quando algo quebrar.\n'
    );
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('[db] conexão com o banco de dados estabelecida');

    warnAboutMissingWhatsAppNumber();
    warnAboutMissingObjectStorage();
    warnAboutMissingMonitoring();
    warnAboutMissingMercadoPagoCredentials();
    // O job de expiração automática de reserva de estoque (30 min sem
    // confirmação de pagamento online) não se aplica mais — o pagamento
    // agora acontece na entrega, então "aguardando_pagamento" pode durar o
    // tempo normal de separação/envio sem que isso seja motivo pra cancelar
    // o pedido sozinho. Cancelamento continua disponível manualmente pelo
    // painel, se um pedido realmente não for adiante.
    scheduleAbandonedCartJob();
    scheduleExpireUnpaidPixChargesJob();

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Dravennx API rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] falha ao iniciar a aplicação:', err);
    process.exit(1);
  }
}

start();

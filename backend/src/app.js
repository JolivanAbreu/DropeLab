const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const routes = require('./routes');
const monitoring = require('./integrations/monitoring');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

monitoring.initMonitoring();

const app = express();

// Necessário em qualquer hospedagem atrás de proxy reverso (Railway, Vercel,
// etc.) — sem isso, o Express não confia no cabeçalho X-Forwarded-For que a
// plataforma envia, e o limitador de tentativas de login (express-rate-limit)
// trava com erro ao tentar identificar o IP de quem está fazendo a
// requisição. O valor "1" confia só no primeiro salto de proxy (o da própria
// plataforma de hospedagem), não em qualquer um — mais seguro que "true".
app.set('trust proxy', 1);

app.use(helmet({
  // crossOriginResourcePolicy padrão bloquearia o frontend (outra origem) de
  // carregar as imagens de /uploads — liberamos apenas para esse diretório.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// O corpo do webhook do Mercado Pago é lido como JSON normalmente — a
// autenticidade é garantida pela verificação de assinatura (x-signature),
// não pelo formato do corpo.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Imagens de produto enviadas pelo painel (upload local em disco — ver
// middlewares/upload.js e admin.routes.js)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/v1', routes);

// Precisa vir depois das rotas (senão não há nada pra capturar) e antes do
// errorHandler final da aplicação (senão o Sentry nunca vê a exceção, já
// convertida em resposta JSON). Vira no-op se SENTRY_DSN não configurado.
monitoring.attachExpressErrorHandler(app);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

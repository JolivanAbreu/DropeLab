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

// Necessário atrás de proxy reverso (Railway, Vercel) — sem isso o
// rate-limiter trava tentando identificar o IP via X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/v1', routes);

monitoring.attachExpressErrorHandler(app);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

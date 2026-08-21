const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const apiRoutes = require('./routes');
const { standardLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (config.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(helmet());
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/store', express.static(path.join(__dirname, '../public/storefront')));
app.use(
  cors({
    origin: [config.storeUrl],
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(standardLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
// توجيه الزائر تلقائياً من الصفحة الرئيسية إلى المتجر
app.get('/', (req, res) => {
  res.redirect('/store/');
});
module.exports = app;

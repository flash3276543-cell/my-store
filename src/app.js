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

// 1. إتاحة ملفات الواجهة والأدمن
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/store', express.static(path.join(__dirname, '../public/storefront')));

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(standardLimiter);

// 2. توجيه الزائر تلقائياً من الرابط الرئيسي إلى المتجر
app.get('/', (req, res) => {
  res.redirect('/store/');
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 3. مسارات الـ API
app.use('/api', apiRoutes);

// 4. معالجة الأخطاء والصفحات المفقودة (يجب أن تكون دائماً في النهاية)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

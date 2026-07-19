require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { getDb } = require('./db');

// ensure DB + schema
getDb();

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3847;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// API
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', orderRoutes);

// Static marketing + apps
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// App shells (Express 5 path syntax)
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
app.get('/dashboard/{*rest}', (_req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
app.get('/drivers', (_req, res) => {
  res.sendFile(path.join(publicDir, 'drivers.html'));
});
app.get('/drivers/{*rest}', (_req, res) => {
  res.sendFile(path.join(publicDir, 'drivers.html'));
});
app.get('/partners', (_req, res) => {
  res.sendFile(path.join(publicDir, 'partners.html'));
});
app.get('/partners/{*rest}', (_req, res) => {
  res.sendFile(path.join(publicDir, 'partners.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  DayLink — same-day device buyback logistics');
  console.log(`  Market:  Ogden → Salt Lake City → Provo`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Partner: http://localhost:${PORT}/dashboard`);
  console.log(`  Driver:  http://localhost:${PORT}/drivers`);
  console.log('');
});

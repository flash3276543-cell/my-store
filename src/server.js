const app = require('./app');
const config = require('./config');

app.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[novendigit-backend] Listening on port ${config.port} (${config.nodeEnv})`);
});

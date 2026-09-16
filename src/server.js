const app = require('./app');
const config = require('./config');
const { bootstrapDatabase } = require('./bootstrap');

async function start() {
  // Bring the database up to date and ensure the admin account exists
  // before accepting traffic. bootstrapDatabase() never throws — if a
  // step fails it logs and continues, so the server always starts.
  await bootstrapDatabase();

  app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[novendigit-backend] Listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start();

import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`MachineGuard API running at http://127.0.0.1:${PORT}`);
});

function shutdown() {
  console.log('Shutting down MachineGuard API...');

  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
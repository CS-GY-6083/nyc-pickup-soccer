// Starts the API server for the NYC Pickup Soccer System.
//
//   npm run dev     restarts on file changes (node --watch)
//   npm start
//
// Settings come from part3/server/.env (see .env.example).
import { app } from './app.js';
import { pool } from './db.js';

const PORT = Number(process.env.PORT) || 3001;
// Only this computer can reach the API (not others on the same Wi-Fi).
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});

// Ctrl+C / kill: finish open requests, then close the database pool.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}

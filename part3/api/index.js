// Vercel entry point: the whole Express API runs as one serverless
// function. vercel.json sends every /api/* request here, and the app's
// own routes (server/src/app.js) handle it exactly as they do locally.
// Locally, the API still runs with `npm run dev` in server/ instead.
import { app } from '../server/src/app.js';

export default app;

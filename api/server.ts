/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initAndSeed } from './db/seed.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

initAndSeed();

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
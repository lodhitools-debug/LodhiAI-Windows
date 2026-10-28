/**
 * Lodhi AI — Standalone Cloud Relay Server Runner
 * Usage:
 *   PORT=4000 LODHI_JWT_SECRET=your-secret node src/server/runServer.js
 *   or via tsx / ts-node
 */

import { startRelayServer } from './relayServer';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.LODHI_JWT_SECRET || 'lodhi-ai-secure-cloud-jwt-secret-key-32bytes';

async function main() {
  console.log('----------------------------------------------------');
  console.log('  LODHI AI — CLOUD RELAY & REMOTE ACCESS SERVICE    ');
  console.log('----------------------------------------------------');
  console.log(`Starting server on ${HOST}:${PORT}...`);

  try {
    const serverInstance = await startRelayServer({
      port: PORT,
      host: HOST,
      jwtSecret: JWT_SECRET,
    });

    console.log(`[STATUS] Cloud Relay listening on port ${serverInstance.port}`);
    console.log(`[HEALTH] http://${HOST}:${serverInstance.port}/health`);
    console.log(`[READY]  http://${HOST}:${serverInstance.port}/ready`);
    console.log(`[METRICS] http://${HOST}:${serverInstance.port}/metrics`);
    console.log('[SECURITY] TLS/WSS termination required via reverse proxy in production.');

    const shutdown = async () => {
      console.log('\nGracefully terminating Lodhi AI Cloud Relay...');
      await serverInstance.close();
      console.log('Relay server stopped.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Fatal error starting Cloud Relay server:', err);
    process.exit(1);
  }
}

main();

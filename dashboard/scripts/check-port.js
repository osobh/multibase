#!/usr/bin/env node

/**
 * Port Availability Checker
 *
 * Usage: node scripts/check-port.js <port>
 * Exit code: 0 if port is available, 1 if in use
 */

const net = require('net');

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false); // Port is available
    });

    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  const port = parseInt(process.argv[2], 10);

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    console.error('Usage: node scripts/check-port.js <port>');
    process.exit(2);
  }

  const inUse = await isPortInUse(port);

  if (inUse) {
    console.log(`Port ${port} is IN USE`);
    process.exit(1); // In use
  } else {
    console.log(`Port ${port} is AVAILABLE`);
    process.exit(0); // Available
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(2);
});

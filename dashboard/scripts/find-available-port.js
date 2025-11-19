#!/usr/bin/env node

/**
 * Find Available Port
 *
 * Usage: node scripts/find-available-port.js <starting-port> [max-attempts]
 * Output: First available port number
 * Exit code: 0 on success, 1 on failure
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

async function findAvailablePort(startPort, maxAttempts = 100) {
  let currentPort = startPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Skip well-known ports and invalid ranges
    if (currentPort > 65535) {
      currentPort = 3000;
    }

    const inUse = await isPortInUse(currentPort);

    if (!inUse) {
      return currentPort; // Found available port
    }

    currentPort++;
    attempts++;
  }

  throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${startPort}`);
}

async function main() {
  const startPort = parseInt(process.argv[2], 10);
  const maxAttempts = parseInt(process.argv[3], 10) || 100;

  if (!startPort || isNaN(startPort) || startPort < 1 || startPort > 65535) {
    console.error('Usage: node scripts/find-available-port.js <starting-port> [max-attempts]');
    process.exit(1);
  }

  try {
    const availablePort = await findAvailablePort(startPort, maxAttempts);
    console.log(availablePort); // Output just the port number for easy parsing
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

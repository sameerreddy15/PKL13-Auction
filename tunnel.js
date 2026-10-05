const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log('\n======================================================');
    console.log('  🌐 PUBLIC MULTIPLAYER AUCTION TUNNEL IS LIVE!     ');
    console.log('======================================================');
    console.log('  Public URL (for ALL devices on Mobile Data / Wi-Fi):');
    console.log('  ' + tunnel.url);
    console.log('======================================================\n');

    tunnel.on('close', () => {
      console.log('Tunnel closed.');
    });
    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to create tunnel:', err);
  }
})();

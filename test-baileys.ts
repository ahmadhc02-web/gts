import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
console.log('Starting version fetch...');
fetchLatestBaileysVersion()
  .then(v => console.log('Version:', v))
  .catch(e => {
    console.error('Error fetching version:', e.message);
    process.exit(0);
  });
setTimeout(() => {
  console.log('Timed out');
  process.exit(0);
}, 5000);

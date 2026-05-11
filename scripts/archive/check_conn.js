const net = require('net');

const client = net.connect({ host: 'db.whpbetjyhpttinbxcffs.supabase.co', port: 5432 }, () => {
    console.log('Connected to host!');
    process.exit(0);
});

client.on('error', (err) => {
    console.error('Error connecting:', err.message);
    process.exit(1);
});

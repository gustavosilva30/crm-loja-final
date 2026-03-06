const fs = require('fs');
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/whatsapp/instances/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', d => { data += d; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${data}`);
    });
});

req.on('error', error => {
    console.error(`Error: ${error.message}`);
});

req.write(JSON.stringify({ atendente_id: 'test' }));
req.end();

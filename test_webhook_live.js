const axios = require('axios');

async function testWebhook() {
    try {
        console.log('Testando endpoint de webhook do servidor...');
        const res = await axios.get('https://api.douradosap.com.br/webhook');
        console.log('GET /webhook:', res.data); // Deve retornar "Webhook is active"
    } catch (e) {
        console.error('Erro ao acessar /webhook:', e.message);
    }
}

testWebhook();

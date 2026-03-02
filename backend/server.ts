import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { whatsappController } from './whatsappController';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Hello World
app.get('/', (req, res) => res.send('WhatsApp CRM Backend Active'));

// Meta Webhook Verification
app.get('/webhook', whatsappController.verifyWebhook);

// Meta Webhook Receiving Messages
app.post('/webhook', whatsappController.receiveMessage);

// Internal API to Send Message
app.post('/api/whatsapp/send', whatsappController.sendMessage);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

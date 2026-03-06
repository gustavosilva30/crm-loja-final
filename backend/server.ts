import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { whatsappController } from './whatsappController';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (_req: Request, res: Response) => {
    res.status(200).send('WhatsApp CRM Backend Active');
});

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        service: 'backend-evo',
        port: PORT,
    });
});

app.get('/webhook', whatsappController.verifyWebhook);
app.post('/webhook', whatsappController.receiveMessage);
app.post('/api/whatsapp/send', whatsappController.sendMessage);
app.post('/api/whatsapp/delete', whatsappController.deleteMessage);
app.post('/api/whatsapp/reaction', whatsappController.sendReaction);
app.post('/api/whatsapp/location', whatsappController.sendLocation);
app.get('/api/whatsapp/status', whatsappController.getConnectionStatus);
app.get('/api/whatsapp/qr', whatsappController.getQrCode);
app.post('/api/whatsapp/disconnect', whatsappController.disconnect);
app.post('/api/whatsapp/fetch-profile-pic', whatsappController.syncProfilePic);
app.post('/api/whatsapp/instances/create', whatsappController.createInstance);
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        error: 'Route not found',
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
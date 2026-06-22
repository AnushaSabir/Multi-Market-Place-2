import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import crawlerRoutes from './routes/crawlerRoutes';
import { authenticateAPI } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

import fs from 'fs';
import path from 'path';

// const logFile = path.resolve(process.cwd(), 'debug_server.log');

// Request logging for debugging
app.use((req, res, next) => {
    const originalSend = res.send;
    const logEntryStart = `[${new Date().toISOString()}] ${req.method} ${req.url}\nBody: ${JSON.stringify(req.body)}\n`;

    res.send = function (body) {
        const logEntryEnd = `Response Status: ${res.statusCode}\nResponse: ${body}\n-------------------\n`;
        console.log(logEntryStart + logEntryEnd);
        // fs.appendFileSync(logFile, logEntryStart + logEntryEnd);
        return originalSend.call(this, body);
    };
    next();
});

// Public Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'local',
        checks: {
            supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
            internalApiKey: Boolean(process.env.INTERNAL_API_KEY),
            billbeeCredentials: Boolean(process.env.BILLBEE_API_KEY && process.env.BILLBEE_USERNAME && process.env.BILLBEE_PASS),
            billbeeMirrorEnabled: process.env.BILLBEE_MIRROR_PICKLIST === 'true',
            ottoCredentials: Boolean(process.env.OTTO_CLIENT_ID && process.env.OTTO_CLIENT_SECRET),
            dhlCredentials: {
                user: Boolean(process.env.DHL_USE_SANDBOX === 'true' ? process.env.DHL_API_USER_SANDBOX : process.env.DHL_API_USER_PROD),
                pass: Boolean(process.env.DHL_USE_SANDBOX === 'true' ? process.env.DHL_API_PASS_SANDBOX : process.env.DHL_API_PASS_PROD),
                clientId: Boolean(process.env.DHL_USE_SANDBOX === 'true' ? process.env.DHL_CLIENT_ID_SANDBOX : process.env.DHL_CLIENT_ID_PROD),
                billingNumber: Boolean(process.env.DHL_BILLING_NUMBER || process.env.DHL_BILLING_NUMBER_PROD),
                ekp: Boolean(process.env.DHL_EKP)
            }
        }
    });
});

import productRoutes from './routes/productRoutes';
import productGetRoutes from './routes/productGetRoutes';
import webhookRoutes from './routes/webhookRoutes';
import syncRoutes from './routes/syncRoutes';
import importRoutes from './routes/importRoutes';
import rateLimit from 'express-rate-limit';
import aiRoutes from './routes/aiRoutes';
import stockRoutes from './routes/stockRoutes';
import productMergeRoutes from './routes/productMergeRoutes';
import settingsRoutes from './routes/settingsRoutes';
import orderRoutes from './routes/orderRoutes';
import picklistRoutes from './routes/picklistRoutes';
import scanstationRoutes from './routes/scanstationRoutes';
import { SyncService } from './services/syncService';
import { RetryService } from './services/retryService';

// Protected Routes
app.use('/api/products', authenticateAPI, productRoutes); // POST/PUT
app.use('/api/products', authenticateAPI, productGetRoutes); // GET
app.use('/api/products', authenticateAPI, stockRoutes); // Stock updates and movements
app.use('/api/products', authenticateAPI, productMergeRoutes); // Product merge (/merge)
app.use('/api/sync', syncRoutes);
app.use('/api/import', authenticateAPI, importRoutes);
app.use('/api/ai', authenticateAPI, aiRoutes);
app.use('/api/settings', authenticateAPI, settingsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/picklist', picklistRoutes);
app.use('/api/scanstation', scanstationRoutes);

// Database check Routes
app.use('/api/webhooks', webhookRoutes);

app.use((err: any, req: any, res: any, next: any) => {
    const errorMsg = `[CRITICAL ERROR] ${err.stack || err.message}\n`;
    console.error(errorMsg);
    // if (process.env.NODE_ENV !== 'production') {
    //     fs.appendFileSync(logFile, errorMsg);
    // }
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Retry Service (runs in background)
if (process.env.NODE_ENV !== 'test') {
    RetryService.start();
}

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app;

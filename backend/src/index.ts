import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crawlerRoutes from './routes/crawlerRoutes';
import { authenticateAPI } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Public Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

import productRoutes from './routes/productRoutes';
import productGetRoutes from './routes/productGetRoutes';
import webhookRoutes from './routes/webhookRoutes';
import syncRoutes from './routes/syncRoutes';
import importRoutes from './routes/importRoutes';
import rateLimit from 'express-rate-limit';

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use('/api', apiLimiter);

import aiRoutes from './routes/aiRoutes';

// Protected Routes
app.use('/api/crawler', authenticateAPI, crawlerRoutes);
app.use('/api/products', authenticateAPI, productRoutes); // POST/PUT
app.use('/api/products', authenticateAPI, productGetRoutes); // GET
app.use('/api/sync', authenticateAPI, syncRoutes);
app.use('/api/import', authenticateAPI, importRoutes);
app.use('/api/ai', authenticateAPI, aiRoutes);

// Webhook Routes (Public or validated by signature, not API key usually, but for MVP we might leave open or add specific middleware)
app.use('/api/webhooks', webhookRoutes);

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app;


import { SyncService } from '../services/syncService';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testSync() {
    const productId = '40125b3b-e857-4f49-b7c8-99234b347815';
    const updates = { price: 14.94, quantity: 56 };

    console.log(`Testing SyncService for product ${productId}...`);
    await SyncService.syncProductUpdateToAll(productId, updates);
    console.log("SyncService test finished.");
}

testSync();

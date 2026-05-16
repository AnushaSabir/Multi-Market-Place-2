import { config } from 'dotenv';
import path from 'path';

// Load .env from backend directory
config({ path: path.resolve(__dirname, '../../../.env') });

import { TokenManger } from '../services/tokenService';
import { OttoImporter } from '../services/importers/ottoImporter';

async function test() {
    try {
        console.log("Testing Otto Token Generation...");
        console.log(`Using Client ID: ${process.env.OTTO_CLIENT_ID?.substring(0, 5)}...`);
        const token = await TokenManger.getAccessToken('otto');
        
        if (!token) {
            console.error("Failed to get Otto access token!");
            return;
        }
        console.log(`Success! Token: ${token.substring(0, 15)}...`);

        console.log("\nTesting Otto Importer...");
        const importer = new OttoImporter();
        const result = await importer.runImport();
        console.log(`Finished import test. Processed count: ${result.count}`);

    } catch (error: any) {
        console.error("Test failed:", error.response?.data || error.message);
    }
}

test();

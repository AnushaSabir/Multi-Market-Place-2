import { supabase } from '../database/supabaseClient';
import axios from 'axios';
import qs from 'qs';

interface MarketplaceCredential {
    id: string;
    marketplace: 'otto' | 'ebay' | 'kaufland' | 'shopify' | 'billbee';
    credentials: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        client_id?: string;
        client_secret?: string;
        client_key?: string; // Kaufland
        secret_key?: string; // Kaufland
        api_key?: string; // Billbee
        username?: string; // Billbee
        password?: string; // Billbee
    };
}

export class TokenManger {

    // Get a valid access token, auto-generating if possible
    static async getAccessToken(marketplace: 'otto' | 'ebay' | 'kaufland' | 'shopify' | 'billbee'): Promise<string | null> {
        const { data, error } = await supabase
            .from('marketplace_credentials')
            .select('*')
            .eq('marketplace', marketplace)
            .single();

        if (error || !data) {
            console.warn(`Credentials for ${marketplace} not found in DB. Checking .env...`);

            // Fallback to .env
            const envCreds: any = {};
            if (marketplace === 'otto') {
                envCreds.client_id = process.env.OTTO_CLIENT_ID;
                envCreds.client_secret = process.env.OTTO_CLIENT_SECRET;
            } else if (marketplace === 'ebay') {
                // If User Token is provided directly (Preferred for Inventory API)
                if (process.env.EBAY_OAUTH_TOKEN) {
                    envCreds.access_token = process.env.EBAY_OAUTH_TOKEN;
                } else {
                    envCreds.client_id = process.env.EBAY_CLIENT_ID;
                    envCreds.client_secret = process.env.EBAY_CLIENT_SECRET;
                }
            } else if (marketplace === 'kaufland') {
                envCreds.client_key = process.env.KAUFLAND_CLIENT_KEY;
                envCreds.secret_key = process.env.KAUFLAND_SECRET_KEY;
            } else if (marketplace === 'shopify') {
                envCreds.access_token = process.env.SHOPIFY_ACCESS_TOKEN;
            }

            if (!envCreds.client_id && !envCreds.client_key && !envCreds.access_token) {
                console.error(`No credentials found in DB or .env for ${marketplace}`);
                return null;
            }

            // Create a mock "data" object to pass downstream
            const mockData = {
                id: 'env_fallback',
                credentials: envCreds
            };

            // If it's Kaufland, Billbee, or Shopify, we return the key directly
            if (marketplace === 'billbee') return envCreds.api_key || null;
            if (marketplace === 'kaufland') return envCreds.client_key || null;
            if (marketplace === 'shopify') return envCreds.access_token || null;
            if (marketplace === 'ebay' && envCreds.access_token) return envCreds.access_token;

            // Otherwise generate token using these env creds
            console.log(`Generating token for ${marketplace} using .env credentials...`);
            return await this.generateTokenFromCredentials('env_fallback', marketplace, envCreds);
        }

        const creds = data.credentials;

        // Special Handling for API-Key based services (Billbee, Kaufland maybe?)
        // If it's Kaufland, we might need the Keys directly, not an Access Token.
        // But for uniformity, we returns 'available' or handle logic.
        if (marketplace === 'billbee') return creds.api_key || null;

        const now = Date.now();

        // If we have a token and it's valid, return it
        if (creds.access_token && creds.expires_at && now < creds.expires_at - 300000) {
            return creds.access_token;
        }

        // Otherwise, try to generate/refresh
        console.log(`Token for ${marketplace} missing or expired. Attempting to generate...`);
        return await this.generateTokenFromCredentials(data.id, marketplace, creds);
    }

    static async generateTokenFromCredentials(id: string, marketplace: string, creds: any): Promise<string | null> {
        try {
            let newAccessToken = '';
            let newExpiresAt = 0; // Epoch ms

            if (marketplace === 'otto') {
                // OAuth2 Client Credentials Flow for Otto (Partners)
                // POST https://api.otto.market/v1/token
                // Header: Basic base64(client_id:client_secret)
                // Body: grant_type=client_credentials

                if (!creds.client_id || !creds.client_secret) throw new Error("Missing Client ID/Secret for Otto");

                const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');

                // Using Sandbox or Prod depending on config? Defaulting to prod URL structure or checking credentials
                const tokenUrl = 'https://api.otto.market/v1/token'; // Verify strict URL

                const res = await axios.post(tokenUrl, qs.stringify({
                    grant_type: 'client_credentials',
                    scope: 'products availability'
                }), {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                console.log(`[TokenManager] Otto Token generated successfully. Expires in ${res.data.expires_in}s`);
                newAccessToken = res.data.access_token;
                newExpiresAt = Date.now() + (res.data.expires_in * 1000);

            } else if (marketplace === 'ebay') {
                // OAuth2 Client Credentials for eBay
                // POST https://api.ebay.com/identity/v1/oauth2/token

                if (!creds.client_id || !creds.client_secret) throw new Error("Missing Client ID/Secret for eBay");

                const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
                const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';

                const res = await axios.post(tokenUrl, qs.stringify({
                    grant_type: 'client_credentials',
                    scope: 'https://api.ebay.com/oauth/api_scope' // Revert to default public scope to fix invalid_scope
                }), {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                newAccessToken = res.data.access_token;
                newExpiresAt = Date.now() + (res.data.expires_in * 1000);

            } else if (marketplace === 'kaufland') {
                // Kaufland usually uses keys to sign, not a token exchange?
                // But if we need to return something, we check if they have a mechanism.
                // If not, we rely on the Importer reading creds directly.
                // We'll return the Client Key as a "Token" placeholder if needed.
                return creds.client_key;
            } else {
                console.warn(`Auto-generation not supported for ${marketplace}`);
                return null;
            }

            if (id === 'env_fallback') {
                console.log(`Generated token for ${marketplace} (env fallback). Skipping DB update.`);
                return newAccessToken;
            }

            // Update DB with new token
            console.log(`Successfully generated new token for ${marketplace}`);
            const updatedCreds = {
                ...creds,
                access_token: newAccessToken,
                expires_at: newExpiresAt
            };

            const { error } = await supabase
                .from('marketplace_credentials')
                .update({
                    credentials: updatedCreds,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) console.error("Failed to save new token to DB:", error);

            return newAccessToken;

        } catch (e: any) {
            console.error(`Failed to generate token for ${marketplace}:`, e.response?.data || e.message);
            return null;
        }
    }
}

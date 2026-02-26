
const fs = require('fs');
const path = require('path');

function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1], 'base64').toString();
        return JSON.parse(payload);
    } catch (e) {
        return null;
    }
}

const backendEnvPath = path.resolve('backend/.env');
const frontendEnvPath = path.resolve('frontend/.env.local');

console.log("--- Backend .env ---");
if (fs.existsSync(backendEnvPath)) {
    const content = fs.readFileSync(backendEnvPath, 'utf8');
    const roleKey = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];
    const url = content.match(/SUPABASE_URL=(.*)/)?.[1];
    console.log("URL:", url);
    if (roleKey) {
        console.log("Decoded Role Key:", JSON.stringify(decodeJWT(roleKey), null, 2));
    }
} else {
    console.log("Backend .env not found");
}

console.log("\n--- Frontend .env.local ---");
if (fs.existsSync(frontendEnvPath)) {
    const content = fs.readFileSync(frontendEnvPath, 'utf8');
    const anonKey = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1];
    const url = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
    console.log("URL:", url);
    if (anonKey) {
        console.log("Decoded Anon Key:", JSON.stringify(decodeJWT(anonKey), null, 2));
    }
} else {
    console.log("Frontend .env.local not found");
}

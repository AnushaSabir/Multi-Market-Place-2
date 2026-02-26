
import axios from 'axios';

async function testNetwork() {
    try {
        console.log("Testing network connectivity...");
        const res = await axios.get('https://www.google.com');
        console.log("Status:", res.status);
        console.log("Network test successful!");
    } catch (err: any) {
        console.error("Network test failed!");
        console.error("Error Message:", err.message);
        if (err.code) console.error("Error Code:", err.code);
    }
}

testNetwork();

import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, FI_COOKIES, options } from "./configs.js";

export { options };

// Global array to collect IDs
let createdIds = [];

export default function () {
    const url = `${BASE_URL}/fi/createClient`;
    const uniqueId = uuidv4().substring(0, 8);
    const idNumber = `TAE${uniqueId}`;

    const payload = {
        login: `test_user_${uniqueId}`,
        password: "stress_test_password",
        name: `Test User ${uniqueId}`,
        dateOfBirth: "1990-01-01",
        address: "123 Fabric Lane, Blockchain City",
        country: "834",
        idNumber: idNumber
    };

    const randomFI = FI_COOKIES[Math.floor(Math.random() * FI_COOKIES.length)];
    const params = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            "Cookie": randomFI.cookie
        },
    };

    const res = http.post(url, payload, params);

    const isSuccessful = check(res, {
        'is status 200': (r) => r.status === 200,
        'has txId': (r) => {
            try { return r.json().txId !== undefined; } catch (e) { return false; }
        },
    });

    if (isSuccessful) {
        // Collect the ID for the next test phase
        createdIds.push(`${idNumber}@${randomFI.name}`);
    }

    // IMPORTANT: Because your Grafana chart shows 2s lag, 
    // we increase sleep to give the Node.js event loop time to recover.
    sleep(2);
}

export function handleSummary(data) {
    console.log(`Test finished. Total IDs collected: ${createdIds.length}`);
    
    return {
        'stdout': JSON.stringify(data), // Standard k6 output to terminal
        'created_ids.json': JSON.stringify(createdIds), // NATIVE file writing
    };
}
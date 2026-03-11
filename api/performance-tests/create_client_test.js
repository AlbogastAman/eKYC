import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, FI_COOKIES, options } from "./configs.js";
import { writeFileSync, open } from 'k6/x/fs';

export { options };

// This array lives in the memory of the k6 process
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

    // SUCCESS LOGIC: Add the ID to our list so we can use it in the GET test
    if (isSuccessful) {
        console.log("res####", res.json())
        createdIds.push(`${idNumber}@${randomFI.name}`);
    }

    sleep(1);
}


export function handleSummary(data) {
    // Write IDs to JSON
    writeFileSync('./created_ids.json', JSON.stringify(createdIds, null, 2));

    // Return the normal summary
    return {
        stdout: JSON.stringify(data, null, 2),
    };
}
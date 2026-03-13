import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, FI_COOKIES, options as baseOptions } from "./configs.js";

export const options = {
    ...baseOptions,
    scenarios: {
        // 1. Write Task: Ledger Consensus (Medium Latency)
        create_task: {
            executor: 'ramping-arrival-rate',
            startRate: 1,              // Start with 1 creation per second
            timeUnit: '1s',
            preAllocatedVUs: 20,       // Pre-warm VUs to handle the ramp
            maxVUs: 100,               // Allow growth if consensus slows down
            stages: [
                { duration: '1m', target: 5 },  // Ramp to 5 TPS
                { duration: '2m', target: 15 }, // Push to 15 TPS (Heavy load for Fabric)
                { duration: '1m', target: 0 },  // Cool down
            ],
            exec: 'createTask',
            tags: { type: 'create' },
        },
        // 2. CPU Task: ZK Verification (High Latency)
        verify_task: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 10 },
                { duration: '3m', target: 20 },
                { duration: '1m', target: 0 },
            ],
            exec: 'verifyTask',
            tags: { type: 'verify' },
        },
        // 3. Read Task: Cache/Ledger Query (Low Latency)
        query_task: {
            executor: 'constant-vus',
            vus: 30,
            duration: '5m',
            exec: 'queryTask',
            tags: { type: 'query' },
        },
    },
};

// Data Loading
const proofPool = new SharedArray('proofs', () => JSON.parse(open('./proof_pool.json')));
const clientIds = new SharedArray('created clients', () => JSON.parse(open('./created_ids.json')));

// Cookie Map for O(1) Lookup
const cookieMap = FI_COOKIES.reduce((acc, fi) => { acc[fi.name] = fi.cookie; return acc; }, {});

/** * SCENARIO 1: CREATE CLIENT (Write)
 */
export function createTask() {
    const uniqueId = uuidv4().substring(0, 8);
    const randomFI = FI_COOKIES[__VU % FI_COOKIES.length];

    const payload = {
        login: `stress_user_${uniqueId}`,
        password: "stress_test_password",
        name: `Stress User ${uniqueId}`,
        dateOfBirth: "1990-01-01",
        address: "123 Fabric Lane",
        country: "834",
        idNumber: `TAE${uniqueId}`
    };

    const params = {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': randomFI.cookie },
        tags: { type: 'create' }
    };

    const res = http.post(`${BASE_URL}/fi/createClient`, payload, params);

    check(res, {
        'create status 200': (r) => r.status === 200,
        'has txId': (r) => { try { return r.json().txId !== undefined; } catch (e) { return false; } },
    });
    sleep(2);
}

/** * SCENARIO 2: VERIFY ZK-VC (CPU)
 */
export function verifyTask() {
    const record = proofPool[Math.floor(Math.random() * proofPool.length)];
    const randomFI = FI_COOKIES[__VU % FI_COOKIES.length];

    const params = {
        headers: { 'Content-Type': 'application/json', 'Cookie': randomFI.cookie },
        tags: { type: 'verify' }
    };

    const res = http.post(`${BASE_URL}/fi/verifyUserVC`, JSON.stringify(record), params);

    check(res, {
        'verify status 200': (r) => r.status === 200,
        'zkp verified': (r) => { try { return r.json().verified === true; } catch (e) { return false; } },
    });
    sleep(2);
}

/** * SCENARIO 3: GET CLIENT DATA (Read)
 */
export function queryTask() {
    const randomId = clientIds[Math.floor(Math.random() * clientIds.length)];
    const [did, fiName] = randomId.split("@");

    const params = {
        headers: { "Cookie": cookieMap[fiName], "Accept": "application/json" },
        tags: { type: 'query' }
    };

    const res = http.get(`${BASE_URL}/fi/getClientData?clientId=${did}&fields=name,address`, params);

    check(res, {
        'query status 200': (r) => r.status === 200,
        'data is non-empty': (r) => { try { return r.json().clientData !== ""; } catch (e) { return false; } },
    });
    sleep(0.5);
}
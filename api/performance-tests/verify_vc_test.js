import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, FI_COOKIES, options } from "./configs.js";

export { options };

// Load our pre-generated pool of valid proofs and IDs
const proofPool = new SharedArray('proofs', function () {
    return JSON.parse(open('./proof_pool.json'));
});

export default function () {
    const url = `${BASE_URL}/fi/verifyUserVC`;

    // Pick a random proof-set from our pool
    const record = proofPool[Math.floor(Math.random() * proofPool.length)];

    const payload = JSON.stringify(record);

    const randomFI = FI_COOKIES[__VU % FI_COOKIES.length];
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': randomFI.cookie
        },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'zkp verified': (r) => r.json().verified === true,
    });

    // ZKP verification is heavy on 2 CPUs. 
    // We use a longer sleep to prevent the Node.js event loop from lagging.
    sleep(2);
}
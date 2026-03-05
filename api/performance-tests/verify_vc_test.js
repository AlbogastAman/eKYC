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
    const url = `${BASE_URL}/api/v1/verifyUserVC`;

    // Pick a random proof-set from our pool
    const record = proofPool[Math.floor(Math.random() * proofPool.length)];

    const payload = JSON.stringify({
        vc: record.vc,
        userDid: record.userDid,
        proof: record.proof,
        publicSignals: record.publicSignals
    });

    const randomFI = FI_COOKIES[Math.floor(Math.random() * FI_COOKIES.length)];
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': randomFI.Cookie
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
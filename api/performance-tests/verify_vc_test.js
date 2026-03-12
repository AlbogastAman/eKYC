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

    const randomFI = FI_COOKIES[Math.floor(Math.random() * FI_COOKIES.length)];
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

export function handleSummary(data) {
    console.log('\n========= Custom Summary Table =========\n');

    console.table({
        'Total Iterations': data.iterations.length,
        'HTTP Requests': data.metrics.http_reqs.count,
        'Successful Checks (%)': (data.metrics.checks.rate * 100).toFixed(2),
        'Failed Requests (%)': (data.metrics.http_req_failed.rate * 100).toFixed(2),
        'Avg Response Time (ms)': data.metrics.http_req_duration.avg.toFixed(2),
        'Median Response Time (ms)': data.metrics.http_req_duration.med.toFixed(2),
        'Max Response Time (ms)': data.metrics.http_req_duration.max.toFixed(2),
        'p95 Response Time (ms)': data.metrics.http_req_duration['p(95)'].toFixed(2),
        'p99 Response Time (ms)': data.metrics.http_req_duration['p(99)'].toFixed(2),
    });

    return {};
}
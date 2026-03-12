import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, FI_COOKIES, options } from "./configs.js";

export { options };

// 1. Load the IDs created by the previous script
// SharedArray is efficient: it only loads the file once for all VUs
const clientIds = new SharedArray('created clients', function () {
    const data = JSON.parse(open('./created_ids.json'));

    // Safety check: if file is empty, provide a fallback to prevent crash
    if (data.length === 0) {
        console.error("No IDs found in created_ids.json! Run the creator script first.");
        return ['fallback_id'];
    }
    return data;
});

export default function () {
    // 2. Pick a random ID from the list
    const randomId = clientIds[Math.floor(Math.random() * clientIds.length)];
    const splittedId = randomId.split("@");
    console.log("####splittedId ", splittedId)
    // 3. Define fields to query (matches your API signature)
    const fields = ['name', 'address'];
    const url = `${BASE_URL}/fi/getClientData?clientId=did:fabric:${splittedId[0]}&fields=${fields}`;
    console.log("####url ", url)
    const params = {
        headers: {
            "Cookie": FI_COOKIES.find(x => x.name === splittedId[1]).cookie,
            "Accept": "application/json"
        },
    };

    const res = http.get(url, params);
    console.log("#### res", res.json())
    // 4. Verification
    check(res, {
        'is status 200': (r) => r.status === 200,
        'data belongs to correct user': (r) => {
            try {
                return r.json().clientData !== "";
            } catch (e) {
                return false;
            }
        },
    });

    // Think time: Simulated delay between user queries
    sleep(0.5);
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
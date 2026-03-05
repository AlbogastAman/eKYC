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

    // 3. Define fields to query (matches your API signature)
    const fields = ['name', 'address'];
    const url = `${BASE_URL}/fi/getClientData?clientId=did:fabric:${splittedId[0]}&fields=${fields}`;

    const params = {
        headers: {
            "Cookie": FI_COOKIES.find(x => x.name === splittedId[1]).cookie,
            "Accept": "application/json"
        },
    };

    const res = http.get(url, params);

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
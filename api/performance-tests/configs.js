export const BASE_URL = 'http://35.239.83.149:5000';

export const options = {
    stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
    ],
    thresholds: {
        // Query should be very fast
        'http_req_duration{type:query}': [
            'p(95)<3000',
            'p(99)<5000'
        ],
        // Creation involves consensus, allow more time
        'http_req_duration{type:create}': [
            'p(95)<5000',
            'p(99)<8000'
        ],
        //VC Verification involves ZK Proofs (Heavy CPU)
        'http_req_duration{type:verify}': [
            'p(95)<10000',
            'p(99)<15000'
        ],
        http_req_failed: ['rate<0.05'],
    },
    summaryTrendStats: [
        'avg', 'min', 'med', 'max',
        'p(90)', 'p(95)', 'p(99)', 'p(99.9)'
    ],
};

export const FI_COOKIES = [
    {
        "name": "FI1",
        "cookie": "userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkZJMSIsImlhdCI6MTc3MzMxMjMzM30.e9jE2FAzura5hCBmxrP2RmjaqxdBCzEMFu7k8hnAjKs; orgCredentials=076bc590948648baa668f60391b1b14a%3Aaa3f53482ddac36575420fbc50f44299140ef0cc1eddbd674ce2e23d664667"
    },
    {
        "name": "FI2",
        "cookie": "userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkZJMiIsImlhdCI6MTc3MzMxMzA4Mn0.8yc-o0quj5dKMwpjKnq63IeOg4sO-Pv763Mtf0JKF7s; orgCredentials=7ef5339ff2e4aee9ed878dca8c947d40%3Aeb9bca5d7b281b1df9b67436b9c6823b0d52cefed91e1184d6f293be5e8d6e"
    }
]
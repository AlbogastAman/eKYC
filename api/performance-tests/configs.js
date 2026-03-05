export const BASE_URL = 'http://34.16.69.199:5000/';

export const options = {
    stages: [
        { duration: '1m', target: 20 }, // You can safely hit 20-30 VUs now
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'], // Fabric writes are slow; 5s is a fair limit
        http_req_failed: ['rate<0.05'],    // Allow 5% failure for MVCC collisions
    },
};

export const FI_COOKIES = [
    {
        "name": "FI1",
        "cookie": "userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkFNQSIsImlhdCI6MTc3MjYzMzk0N30.alGotzkNZVdjH_9tUwvHE6nsm5fAjDRV3o3yHWLGVY0; ledgerId=did%3Afabric%3Aekyc%3AAMA; whoRegistered=fe84a3c9125c771ce04db8b89af14eb9%3A0cb28c72e8bb8130838da480026ad20a26eb4f75364cdd07a6e2a6c097160ee460d34d2c78d20cc9c1b593fd51c6fdd5f7ea13f234bd5bae; userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkZJMSIsImlhdCI6MTc3MjcxOTc2NH0.SAta8xr9TXG4KB9P5c-gtKM7YDMVRW1y8sYPPnhlmLQ; orgCredentials=076bc590948648baa668f60391b1b14a%3Aaa3f53482ddac36575420fbc50f44299140ef0cc1eddbd674ce2e23d664667"
    },
    {
        "name": "FI2",
        "cookie": "userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkFNQSIsImlhdCI6MTc3MjYzMzk0N30.alGotzkNZVdjH_9tUwvHE6nsm5fAjDRV3o3yHWLGVY0; ledgerId=did%3Afabric%3Aekyc%3AAMA; whoRegistered=fe84a3c9125c771ce04db8b89af14eb9%3A0cb28c72e8bb8130838da480026ad20a26eb4f75364cdd07a6e2a6c097160ee460d34d2c78d20cc9c1b593fd51c6fdd5f7ea13f234bd5bae; userJWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6IkZJMSIsImlhdCI6MTc3MjcyMDg2NH0.uOKVLZcx6bNckJyPKLg_9z31kBz9KDOWSfE8yI6BOiw; orgCredentials=076bc590948648baa668f60391b1b14a%3Aaa3f53482ddac36575420fbc50f44299140ef0cc1eddbd674ce2e23d66466"
    }
]
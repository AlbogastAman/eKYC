const { parentPort, workerData, Worker } = require('node:worker_threads');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

/**
 * CRITICAL FIX: Polyfill global.Worker
 * snarkjs uses a library called ffjavascript that looks for a global 'Worker' 
 * constructor to handle multithreading. Inside a Worker Thread, this is undefined.
 * We map it to the Node.js Worker class to satisfy the dependency.
 */
global.Worker = Worker;

// Load the Verification Key once when the worker thread starts
const vKeyPath = path.join(__dirname, "./build/requirements_check_key.json");
let vKey;

try {
    vKey = JSON.parse(fs.readFileSync(vKeyPath));
} catch (err) {
    parentPort.postMessage({ 
        isValid: false, 
        error: `Worker failed to load vKey at ${vKeyPath}: ${err.message}` 
    });
}

/**
 * Verification Logic
 */
async function verifyProof() {
    try {
        const { publicSignals, proof } = workerData;

        if (!publicSignals || !proof) {
            throw new Error("Missing publicSignals or proof in workerData");
        }

        // We use the pre-loaded vKey and the inputs passed from the main thread
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        // Send the result back to the main thread
        parentPort.postMessage({ isValid });

    } catch (error) {
        parentPort.postMessage({ 
            isValid: false, 
            error: error.message 
        });
    } finally {
        // Optional: Ensure we terminate the worker if not using a pool
        // process.exit(0); 
    }
}

// Execute
verifyProof();
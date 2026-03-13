const { parentPort, workerData } = require('node:worker_threads');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const vKeyPath = path.join(__dirname, "./build/requirements_check_key.json");
const vKey = JSON.parse(fs.readFileSync(vKeyPath));

async function verify() {
    console.log("Nafika hapa####")
    try {
        const { publicSignals, proof } = workerData;
        
        // 2. MATH EXECUTION (CPU Intensive)
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        
        parentPort.postMessage({ isValid });
    } catch (error) {
        parentPort.postMessage({ isValid: false, error: error.message });
    }
}

verify();
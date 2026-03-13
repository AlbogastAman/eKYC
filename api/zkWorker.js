const { parentPort, workerData } = require('node:worker_threads');
const snarkjs = require('snarkjs');

async function verify() {
    try {
        const { vKey, publicSignals, proof } = workerData;
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        parentPort.postMessage({ isValid });
    } catch (error) {
        parentPort.postMessage({ isValid: false, error: error.message });
    }
}
verify();
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class MixedWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.runID = this.roundArguments.seed || 'STRESS';
        this.laneSize = 100000;

        const preloadTotal = this.roundArguments.totalAssets || 1500;
        this.assetsPreloadedPerWorker = Math.floor(preloadTotal / this.totalWorkers);
        this.mixedWriteOffset = 500000;

        // Define the pool of valid identities found in your logs
        this.invokerPool = ['FI1', '_Org2MSP_FI2'];
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Randomly pick an invoker for this specific transaction
        const currentInvoker = this.invokerPool[Math.floor(Math.random() * this.invokerPool.length)];

        const isWrite = Math.random() < 0.05; // 5% Write probability

        // --- 95% READS ---
        if (!isWrite) {
            const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);
            const randomIndexInLane = Math.floor(Math.random() * this.assetsPreloadedPerWorker) + 1;
            const globalReadIndex = (randomWorkerLane * this.laneSize) + randomIndexInLane;
            const readDid = `did:fabric:usr_${this.runID}_${globalReadIndex}`;

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'readAnchor', // Ensure this matches your CC function name
                invokerIdentity: currentInvoker,
                contractArguments: [readDid],
                readOnly: true
            });
        }

        // --- 5% WRITES ---
        else {
            const uniqueWriteIndex = this.mixedWriteOffset + (this.workerIndex * this.laneSize) + this.txIndex;
            const writeDid = `did:fabric:usr_mixed_${this.runID}_${uniqueWriteIndex}`;

            let _fiIndex = currentInvoker.includes('Org2') ? 2 : 1;

            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: 'FI' + _fiIndex, orgNum: _fiIndex }
            };
            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'createClient',
                invokerIdentity: currentInvoker,
                contractArguments: [JSON.stringify(client), hash],
                readOnly: false
            });
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
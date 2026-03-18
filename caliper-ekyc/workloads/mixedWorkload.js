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

        // Parameters from Benchmark Config
        this.runID = this.roundArguments.seed || 'FINAL_01';
        this.laneSize = 100000;
        const preloadTotal = this.roundArguments.totalAssets || 1500;
        
        // Calculate the range this specific worker should target for reads
        this.assetsPreloadedPerWorker = Math.floor(preloadTotal / this.totalWorkers);
        
        // Offset for new writes to avoid collisions with preloaded data
        this.mixedWriteOffset = 500000;

        // Identity Pool - Matches your Caliper logs
        this.invokerPool = ['FI1', '_Org2MSP_FI2'];
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Randomly pick an invoker from the pool
        const currentInvoker = this.invokerPool[Math.floor(Math.random() * this.invokerPool.length)];
        
        // 2. Determine if this is a Read (95%) or Write (5%)
        const isWrite = Math.random() < 0.05;

        if (!isWrite) {
            // --- 95% READS: Target existing assets ---
            const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);
            const randomIndexInLane = Math.floor(Math.random() * this.assetsPreloadedPerWorker) + 1;
            const globalReadIndex = (randomWorkerLane * this.laneSize) + randomIndexInLane;
            const readDid = `did:fabric:usr_${this.runID}_${globalReadIndex}`;

            const request = {
                contractId: 'eKYC',
                contractFunction: 'readAnchor',
                invokerIdentity: currentInvoker,
                contractArguments: [readDid],
                readOnly: true
            };

            // MUST return the promise for the Feedback Controller to track "in-flight" txs
            return this.sutAdapter.sendRequests(request);
        } else {
            // --- 5% WRITES: Create new "Mixed" assets ---
            const uniqueWriteIndex = this.mixedWriteOffset + (this.workerIndex * this.laneSize) + this.txIndex;
            const writeDid = `did:fabric:usr_mixed_${this.runID}_${uniqueWriteIndex}`;

            // Determine Org Info based on the invoker string
            const isOrg2 = currentInvoker.includes('Org2');
            const orgNum = isOrg2 ? 2 : 1;
            const displayUser = isOrg2 ? 'FI2' : 'FI1';

            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: displayUser, orgNum: orgNum }
            };
            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            const request = {
                contractId: 'eKYC',
                contractFunction: 'createClient',
                invokerIdentity: currentInvoker,
                contractArguments: [JSON.stringify(client), hash],
                readOnly: false
            };

            // MUST return the promise
            return this.sutAdapter.sendRequests(request);
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
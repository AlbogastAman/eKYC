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
        this.laneSize = 100000; // Match the lane size from earlier rounds
        
        // Total assets per worker from the PRELOAD phase (e.g., 10k total / 3 workers)
        const preloadTotal = this.roundArguments.totalAssets || 10000;
        this.assetsPreloadedPerWorker = Math.floor(preloadTotal / this.totalWorkers);
        
        // We start mixed writes at a very high offset to avoid any overlap
        this.mixedWriteOffset = 500000; 
        
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;
        const isWrite = Math.random() < 0.05; // 5% Write probability

        // --- 95% READS: Targeting the Sharded Lanes (0, 100k, 200k) ---
        if (!isWrite) {
            const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);
            const randomIndexInLane = Math.floor(Math.random() * this.assetsPreloadedPerWorker) + 1;
            
            // Reconstruct the DID from the preload lanes
            const globalReadIndex = (randomWorkerLane * this.laneSize) + randomIndexInLane;
            const readDid = `did:fabric:usr1_${this.runID}_${globalReadIndex}`;

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'readAnchor',
                invokerIdentity: this.invoker,
                contractArguments: [readDid],
                readOnly: true
            });
        } 

        // --- 5% WRITES: Creating new entries in a separate "Mixed" lane ---
        else {
            // Formula: MixedOffset + (WorkerLane) + Progress
            const uniqueWriteIndex = this.mixedWriteOffset + (this.workerIndex * this.laneSize) + this.txIndex;
            const writeDid = `did:fabric:usr1_mixed_${this.runID}_${uniqueWriteIndex}`;
            
            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: this.invoker, orgNum: 1 }
            };
            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'createClient',
                invokerIdentity: this.invoker,
                contractArguments: [JSON.stringify(client), hash],
                readOnly: false
            });
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
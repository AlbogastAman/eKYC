'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.runID = this.roundArguments.seed || 'STRESS';
        this.totalAssets = this.roundArguments.totalAssets || 10000;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick ANY random number between 1 and the total preloaded count
        // This ensures all workers spread their load across the entire 10k database
        const globalRandomIndex = Math.floor(Math.random() * this.totalAssets) + 1;
        
        // 2. Reconstruct the global DID format
        const did = `did:fabric:usr_${this.runID}_${globalRandomIndex}`;

        return this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: this.invoker,
            contractArguments: [did],
            readOnly: true // Crucial: Bypasses Orderer to save CPU/Network bandwidth
        });
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
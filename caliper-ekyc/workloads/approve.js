'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ApproveWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.totalPreloaded = 10000;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig);
        
        // Split the 10k DIDs among the workers
        // E.g., Worker 0 takes 0-1999, Worker 1 takes 2000-3999...
        this.rangeSize = Math.floor(this.totalPreloaded / totalWorkers);
        this.workerStart = workerIndex * this.rangeSize;
    }

    async submitTransaction() {
        // Calculate an index that stays within this worker's assigned range
        const localIndex = this.txIndex % this.rangeSize;
        const globalIndex = this.workerStart + localIndex;
        const did = `did:fabric:user${globalIndex}`;

        this.txIndex++;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'approve',
            invokerIdentity: 'FI1', // Must be the identity that registered the DID
            contractArguments: [did, 'FI2'],
            readOnly: false
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ApproveWorkload();
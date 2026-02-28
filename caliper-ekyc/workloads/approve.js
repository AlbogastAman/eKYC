'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ApproveWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.runID = this.roundArguments.seed || 'STRESS';
        this.totalAssets = this.roundArguments.totalAssets || 10000;
        
        // Divide the 10,000 preloaded assets among the 3 workers
        this.assetsPerWorker = Math.floor(this.totalAssets / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // Stay in your "lane" to avoid worker-on-worker collisions
        // This math ensures Worker 0 only approves IDs 1-3333, Worker 1 approves 3334-6666, etc.
        const globalUniqueIndex = (this.workerIndex * this.assetsPerWorker) + (this.txIndex % this.assetsPerWorker) + 1;
        
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'approve',
            invokerIdentity: this.invoker, 
            contractArguments: [did, 'FI2'], 
            readOnly: false // Update operation
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ApproveWorkload();
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ApproveWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.runID = this.roundArguments.seed || 'STRESS';
        this.offset = this.roundArguments.offset || 0;
        
        // Use the EXACT same lane size as createClient.js
        this.laneSize = 100000; 
        
        // This is the number of assets each worker actually created per round
        // Defaulting to 1666 (5000 total / 3 workers)
        this.assetsCreatedPerWorker = Math.floor((this.roundArguments.totalRequests || 5000) / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // Calculate the DID using the synchronized "Lane" math
        // We use modulo (%) so if the test runs longer than the data available, 
        // it just loops back and re-approves the same IDs (perfectly fine for stress testing)
        const localIndex = (this.txIndex % this.assetsCreatedPerWorker) + 1;
        const globalUniqueIndex = this.offset + (this.workerIndex * this.laneSize) + localIndex;
        
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'approve',
            invokerIdentity: this.invoker, 
            contractArguments: [did, 'FI2'], 
            readOnly: false // Update operation (Read-Modify-Write)
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ApproveWorkload();
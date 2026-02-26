'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ApproveWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // Match the seed and pool size from the YAML
        this.runID = this.roundArguments.seed;
        this.totalAssets = this.roundArguments.totalAssets || 10000;
        
        // Calculate the range of assets this worker is responsible for
        this.assetsPerWorker = Math.floor(this.totalAssets / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick an index within the range this worker "owns" 
        // Using modulo ensures we cycle through the same IDs if txNumber > assetsPerWorker
        const localIndex = (this.txIndex % this.assetsPerWorker) + 1;
        
        // 2. Reconstruct the DID that was created in the preload phase
        const did = `did:fabric:usr_${this.runID}_${this.workerIndex}_${localIndex}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'approve',
            invokerIdentity: this.invoker, 
            contractArguments: [did, 'FI2'], // Approving FI2 to see FI1's anchor
            readOnly: false // This is a ledger update
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ApproveWorkload();
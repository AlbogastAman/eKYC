'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.runID = this.roundArguments.seed || 'FINAL_01';
        // We use FI1 because they are the owner who just created the data
        this.invoker = '_Org2MSP_FI2'; 
    }

    async submitTransaction() {
        // Targeted Logic: Always look for the first asset of the first worker.
        // Formula: (Worker 0 * 100,000) + 1 = 1
        const anchorDID = `did:fabric:usr_${this.runID}_1`;

        return this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: this.invoker,
            contractArguments: [anchorDID],
            readOnly: true 
        });
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
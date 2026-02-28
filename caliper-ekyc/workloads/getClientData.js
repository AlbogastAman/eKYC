'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // Match the seed and pool size from the YAML
        this.runID = this.roundArguments.seed || 'STRESS';
        this.totalAssets = this.roundArguments.totalAssets || 10000;
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick ANY number from the total pool created by all workers
        const globalRandomIndex = Math.floor(Math.random() * this.totalAssets) + 1;
        
        // 2. Reconstruct the global DID format: did:fabric:usr_[Seed]_[Number]
        const did = `did:fabric:usr_${this.runID}_${globalRandomIndex}`;

        // 3. Alternate field requests to test CouchDB projection performance
        const fields = this.txIndex % 2 === 0 ? "did,whoRegistered" : "did,status";

        const request = {
            contractId: 'eKYC',
            contractFunction: 'getClientData',
            invokerIdentity: this.invoker,
            contractArguments: [did, fields],
            readOnly: true
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new GetClientDataWorkload();
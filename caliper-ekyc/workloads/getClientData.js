'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // Match the seed and pool size from the YAML
        this.runID = this.roundArguments.seed;
        this.totalAssets = this.roundArguments.totalArguments.totalAssets || 10000;
        this.assetsPerWorker = Math.floor(this.totalAssets / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Target the preloaded data pool deterministically
        const targetWorker = Math.floor(Math.random() * this.totalWorkers);
        const targetIndex = Math.floor(Math.random() * this.assetsPerWorker) + 1;
        
        const did = `did:fabric:usr_${this.runID}_${targetWorker}_${targetIndex}`;

        // 2. Simulate requesting different field sets (PII vs Metadata)
        // Note: Ensure your chaincode's getClientData supports the "fields" argument string
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
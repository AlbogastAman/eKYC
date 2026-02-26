'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // Use the seed and asset count from the YAML configuration
        this.runID = this.roundArguments.seed;
        this.totalAssets = this.roundArguments.totalAssets || 10000;
        
        // Calculate the range each worker produced in the write round
        this.assetsPerWorker = Math.floor(this.totalAssets / this.totalWorkers);
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick a random worker from the original pool
        const targetWorker = Math.floor(Math.random() * this.totalWorkers);
        
        // 2. Pick a random index within the range that worker created
        const randomIndex = Math.floor(Math.random() * this.assetsPerWorker) + 1;
        
        // 3. Reconstruct the DID: did:fabric:usr_[seed]_[worker]_[index]
        const did = `did:fabric:usr_${this.runID}_${targetWorker}_${randomIndex}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: this.invoker,
            contractArguments: [did],
            readOnly: true // This triggers 'evaluateTransaction' (Peer-only, no Orderer)
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // 1. Configuration from YAML
        this.runID = this.roundArguments.seed || 'FINAL_01';
        this.totalAssets = this.roundArguments.totalAssets || 1500;
        
        // 2. Identity Mapping - The Fix for "No contracts found"
        // We prioritize the argument passed from the Benchmark YAML
        this.invoker = this.roundArguments.invoker || 'FI2'; 
        
        // 3. Sharding Logic (Must match createClient.js)
        this.laneSize = 100000; 
        this.assetsPerWorker = Math.floor(this.totalAssets / this.totalWorkers);
    }

    async submitTransaction() {
        this.txIndex++;

        // 4. Randomized Read Logic
        const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);
        const randomIndexInLane = Math.floor(Math.random() * this.assetsPerWorker) + 1;
        
        // Construct the DID: did:fabric:usr_[Seed]_[GlobalIndex]
        const globalUniqueIndex = (randomWorkerLane * this.laneSize) + randomIndexInLane;
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        // 5. Query Execution
        // Using 'evaluateTransaction' logic via readOnly: true
        const request = {
            contractId: 'eKYC',
            contractFunction: 'getClientData',
            invokerIdentity: this.invoker, // Targeted Org2 Identity
            contractArguments: [did],
            readOnly: true 
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new GetClientDataWorkload();
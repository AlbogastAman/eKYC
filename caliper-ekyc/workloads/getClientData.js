'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.runID = this.roundArguments.seed || 'STRESS';
        this.offset = this.roundArguments.offset || 0;
        
        // Match the exact lane size used in createClient.js
        this.laneSize = 100000; 
        
        // Calculate assets per worker based on the preload round (e.g., 5000 / 3)
        const totalInRound = this.roundArguments.totalRequests || 5000;
        this.assetsCreatedPerWorker = Math.floor(totalInRound / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI2';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick a random worker's lane to ensure we spread queries across the whole DB
        const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);
        
        // 2. Pick a random index within that specific lane's range
        const randomIndexInLane = Math.floor(Math.random() * this.assetsCreatedPerWorker) + 1;
        
        // 3. Reconstruct the Global DID: usr_[Seed]_[LaneOffset + Index]
        const globalUniqueIndex = this.offset + (randomWorkerLane * this.laneSize) + randomIndexInLane;
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        // 4. Test "Field Projection" (Selective Read)
        // This is a great test for your 2 CPU VM to see if filtering fields saves CPU time
        const fields = this.txIndex % 2 === 0 ? "did,whoRegistered" : "did,status";

        return this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'getClientData',
            invokerIdentity: this.invoker,
            contractArguments: [did, fields],
            readOnly: true
        });
    }
}

module.exports.createWorkloadModule = () => new GetClientDataWorkload();
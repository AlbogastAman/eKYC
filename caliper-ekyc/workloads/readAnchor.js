'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.runID = this.roundArguments.seed || 'FINAL_01';
        this.offset = this.roundArguments.offset || 0;
        this.laneSize = 100000;

        // IMPORTANT: If you preloaded 5000 assets total with 3 workers:
        // 5000 / 3 = 1666 assets per worker.
        // If you tell the script this value is 10,000, it will look for IDs that don't exist.
        const totalPreloadedInRound = 5000;
        this.assetsCreatedPerWorker = Math.floor(totalPreloadedInRound / this.totalWorkers);

        this.invoker = 'FI2';
    }

    async submitTransaction() {
        this.txIndex++;

        // 1. Pick a random worker's lane (0, 1, or 2)
        const randomWorkerLane = Math.floor(Math.random() * this.totalWorkers);

        // 2. Pick a random index within that worker's created range
        const randomIndexInLane = Math.floor(Math.random() * this.assetsCreatedPerWorker) + 1;

        // 3. Reconstruct the Global ID
        const globalUniqueIndex = this.offset + (randomWorkerLane * this.laneSize) + randomIndexInLane;

        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        return this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: this.invoker,
            contractArguments: [did],
            readOnly: true // Bypasses the Orderer for pure read performance
        });
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
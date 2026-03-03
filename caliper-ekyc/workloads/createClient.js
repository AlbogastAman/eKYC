'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class CreateClientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.runID = this.roundArguments.seed || 'STRESS';
        this.offset = this.roundArguments.offset || 0;
        
        // SAFETY: If Caliper doesn't pass the total, we assume a safe buffer.
        // We use a large multiplier (100,000) to ensure workers never cross "lanes".
        this.laneSize = 100000; 
        this.invoker = 'FI1';
        
        console.log(`Worker ${this.workerIndex} initialized. Lane starts at: ${this.offset + (this.workerIndex * this.laneSize)}`);
    }

    async submitTransaction() {
        this.txIndex++;

        // New Robust Formula:
        // Round Offset + (Worker ID * 100,000) + Transaction Progress
        // Worker 0: 0, 1, 2...
        // Worker 1: 100000, 100001...
        // Worker 2: 200000, 200001...
        const globalUniqueIndex = this.offset + (this.workerIndex * this.laneSize) + this.txIndex;
        
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        const client = {
            did: did,
            whoRegistered: { ledgerUser: 'FI2', orgNum: 1 }
        };

        const hash = crypto.createHash('sha256').update(did).digest('hex');

        return this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'createClient',
            invokerIdentity: this.invoker,
            contractArguments: [JSON.stringify(client), hash]
        });
    }
}

module.exports.createWorkloadModule = () => new CreateClientWorkload();
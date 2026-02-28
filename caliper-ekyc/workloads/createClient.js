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
        
        // Split the 5000 transactions of the round among the 3 workers
        // 5000 / 3 = 1666 transactions per worker
        this.txsPerWorker = Math.floor(this.totalRequests / this.totalWorkers);
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;

        // Each worker stays in their own "lane"
        // Worker 0: 0 + (0*1666) + 1 = 1
        // Worker 1: 0 + (1*1666) + 1 = 1667
        // Worker 2: 0 + (2*1666) + 1 = 3333
        const globalUniqueIndex = this.offset + (this.workerIndex * this.txsPerWorker) + this.txIndex;
        
        const did = `did:fabric:usr_${this.runID}_${globalUniqueIndex}`;

        const client = {
            did: did,
            whoRegistered: { ledgerUser: 'FI1', orgNum: 1 }
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
'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class CreateClientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        // 1. Initialize txIndex here to prevent "NaN"
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        // 2. Use the Seed from YAML if available, otherwise fallback to a timestamp
        this.runID = (this.roundArguments && this.roundArguments.seed)
            ? this.roundArguments.seed
            : Date.now().toString().slice(-6);

        this.invoker = 'FI1';
    }

    async submitTransaction() {
        // 3. Increment counter
        this.txIndex++;

        // 4. Build the DID. Note: workerIndex is provided by the Base class
        // format: did:fabric:usr_Seed_Worker_Index
        const did = `did:fabric:usr_${this.runID}_${this.workerIndex}_${this.txIndex}`;

        const client = {
            did: did,
            whoRegistered: {
                ledgerUser: 'FI1',
                orgNum: 1
            }
        };

        const hash = crypto.createHash('sha256').update(did).digest('hex');

        const request = {
            contractId: 'eKYC',
            contractFunction: 'anchorCredential',
            invokerIdentity: this.invoker,
            // Ensure your chaincode expects a JSON String or an Object
            contractArguments: [JSON.stringify(client), hash]
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new CreateClientWorkload();
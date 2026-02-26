'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class AnchorCredentialWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        // Create a unique prefix for this specific test execution
        this.runID = Date.now().toString().slice(-6); 
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig);
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;
        
        // Format: usr_[Timestamp]_[Worker]_[Index]
        // Example: did:fabric:usr_822341_0_15
        const userIdentifier = `${this.runID}_${this.workerIndex}_${this.txIndex}`;
        const did = `did:fabric:usr${userIdentifier}`;

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
            contractArguments: [JSON.stringify(client), hash]
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new AnchorCredentialWorkload();
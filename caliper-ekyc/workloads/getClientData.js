'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.totalPreloaded = 10000;
    }

    async submitTransaction() {
        // Expand range to hit the full 10k dataset
        const index = this.txIndex % this.totalPreloaded;
        const did = `did:fabric:user${index}`;
        this.txIndex++;

        // Simulate requesting different field sets (PII vs Metadata)
        const fields = this.txIndex % 2 === 0 ? "did,whoRegistered" : "did,status";

        const request = {
            contractId: 'eKYC',
            contractFunction: 'getClientData',
            invokerIdentity: 'FI1',
            contractArguments: [did, fields],
            readOnly: true
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new GetClientDataWorkload();
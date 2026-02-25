'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.totalPreloaded = 10000; // Match your Phase 0 dataset
    }

    async submitTransaction() {
        // Use a modulo of the total preloaded set to ensure we are hitting valid keys
        const index = this.txIndex % this.totalPreloaded;
        const did = `did:fabric:user${index}`;

        this.txIndex++;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: 'FI1',
            contractArguments: [did],
            // Optimization: readOnly ensures this doesn't go to the Orderer
            readOnly: true 
        };

        // CRITICAL: Must return the promise for Caliper to record metrics accurately
        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
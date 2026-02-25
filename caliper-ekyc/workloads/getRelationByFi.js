'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RelationByFiWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;

        // Rotate between identities to scan different parts of the fiId~clientId index
        const invokers = ['FI1', 'FI2'];
        const invoker = invokers[this.txIndex % invokers.length];

        const request = {
            contractId: 'eKYC',
            contractFunction: 'getRelationByFi',
            invokerIdentity: invoker,
            contractArguments: [], // Function takes no args, uses getCallerId internally
            readOnly: true
        };

        // Return the promise to ensure Caliper measures the full iteration time
        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new RelationByFiWorkload();
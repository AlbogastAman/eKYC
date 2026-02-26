'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RelationByFiWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.txIndex = 0;
        // Rotating invokers ensures we test the index for multiple FIs
        this.invokers = ['FI1', 'FI2']; 
    }

    async submitTransaction() {
        this.txIndex++;

        // Rotate identity based on transaction index
        const currentInvoker = this.invokers[this.txIndex % this.invokers.length];

        const request = {
            contractId: 'eKYC',
            contractFunction: 'getRelationByFi',
            invokerIdentity: currentInvoker,
            contractArguments: [], // Internal logic uses ClientID from the certificate
            readOnly: true
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new RelationByFiWorkload();
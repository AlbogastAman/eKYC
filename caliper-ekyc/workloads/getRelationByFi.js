'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RelationByFiWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        await this.sutAdapter.sendRequests({
            contractId: 'eKYC',
            contractFunction: 'getRelationByFi',
            invokerIdentity: 'F11',
            contractArguments: [],
            readOnly: true
        });
    }
}

module.exports.createWorkloadModule = () => new RelationByFiWorkload();
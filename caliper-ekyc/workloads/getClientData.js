'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class GetClientDataWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        const did = `did:fabric:user${this.txIndex % 500}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'getClientData',
            invokerIdentity: 'FI1',
            contractArguments: [
                did,
                "did"
            ],
            readOnly: true
        };

        await this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new GetClientDataWorkload();
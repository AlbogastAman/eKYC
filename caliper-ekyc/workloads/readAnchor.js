'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadAnchorWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        const did = `did:fabric:user${this.txIndex % 1000}`;

        const request = {
            contractId: 'eKYC',
            contractFunction: 'readAnchor',
            invokerIdentity: 'org2user1',
            contractArguments: [did],
            readOnly: true
        };

        await this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new ReadAnchorWorkload();
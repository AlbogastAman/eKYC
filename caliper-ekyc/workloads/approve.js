'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ApproveWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        // pick an existing DID
        const index = this.txIndex % 10000;
        const did = `did:fabric:user${index}`;

            await this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'approve',
                invokerIdentity: 'org1user1',   // must match whoRegistered
                contractArguments: [
                    did,
                    'FI1'   // FI being approved
                ],
                readOnly: false
            });
    }
}

module.exports.createWorkloadModule = () => new ApproveWorkload();
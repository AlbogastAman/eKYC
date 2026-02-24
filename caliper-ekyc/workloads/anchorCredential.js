'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class AnchorCredentialWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        const index = this.txIndex;
        const did = `did:fabric:user${index}`;

        const client = {
            did: did,
            whoRegistered: {
                ledgerUser: "User1@org1.example.com"   // MUST match cert CN
            }
        };

        const hash = crypto
            .createHash('sha256')
            .update(`credential-${index}`)
            .digest('hex');

        const request = {
            contractId: 'eKYC',
            contractFunction: 'anchorCredential',
            invokerIdentity: 'org1user1',  // maps to User1 cert
            contractArguments: [
                JSON.stringify(client),
                hash
            ],
            readOnly: false
        };

        await this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new AnchorCredentialWorkload();
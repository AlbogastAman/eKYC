'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class AnchorCredentialWorkload extends WorkloadModuleBase {

    constructor() {
        super();
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {

        const index = this.txIndex++;
        const did = `did:fabric:user${index}`;

        const client = {
            did: did,
            whoRegistered: {
                ledgerUser: 'FI1',
                orgNum: 1
            }
        };

        const hash = crypto
            .createHash('sha256')
            .update(`credential-${index}`)
            .digest('hex');

        const request = {
            contractId: 'eKYC',
            contractFunction: 'anchorCredential',
            invokerIdentity: this.invoker,
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
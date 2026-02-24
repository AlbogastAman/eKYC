'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RegisterFIWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        const did = "did:fabric:org1";

        const jwk = JSON.stringify({
            kty: "RSA",
            e: "AQAB",
            n: "testkey"
        });

        const request = {
            contractId: 'ekyc',
            contractFunction: 'registerFI',
            invokerIdentity: 'org1admin',
            contractArguments: [did, jwk],
            readOnly: false
        };

        await this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new RegisterFIWorkload();
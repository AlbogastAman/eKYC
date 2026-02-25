'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class AnchorCredentialWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    /**
     * Initialize worker-specific context to prevent collisions
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig);
        this.invoker = 'FI1';
        // Ensure each worker starts with a unique offset
        this.workerOffset = workerIndex * 1000000; 
    }

    async submitTransaction() {
        this.txIndex++;
        // Combine worker ID and index for a globally unique DID
        const globalIndex = this.workerOffset + this.txIndex;
        const did = `did:fabric:userr${globalIndex}`;

        const client = {
            did: did,
            whoRegistered: {
                ledgerUser: 'FI1',
                orgNum: 1
            }
        };

        const hash = crypto
            .createHash('sha256')
            .update(`credential-${globalIndex}-${Date.now()}`)
            .digest('hex');

        const request = {
            contractId: 'eKYC',
            contractFunction: 'anchorCredential',
            invokerIdentity: this.invoker,
            contractArguments: [
                JSON.stringify(client),
                hash
            ],
            // Optimization: If using Fabric Gateway, you can set a timeout 
            // to prevent requests from hanging during stress rounds
            timeout: 30 
        };

        return this.sutAdapter.sendRequests(request);
    }
}

module.exports.createWorkloadModule = () => new AnchorCredentialWorkload();
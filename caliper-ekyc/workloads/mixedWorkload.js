'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class MixedWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        // Total records preloaded in Phase 0
        this.totalPreloaded = 10000; 
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, numberofRequests, adapterConfig, contractConfig);
        // Start writes far beyond the preloaded range to avoid collisions
        this.writeOffset = this.totalPreloaded + (workerIndex * 100000);
    }

    async submitTransaction() {
        this.txIndex++;
        const random = Math.random();

        const identities = [
            { invoker: 'FI1', ledgerUser: 'FI1' },
            { invoker: 'FI2', ledgerUser: 'FI2' }
        ];
        const identity = identities[this.workerIndex % identities.length];

        // --- 70% READ OPERATIONS ---
        if (random < 0.7) {
            // Read from the PRELOADED pool only to ensure keys exist
            const readIndex = Math.floor(Math.random() * this.totalPreloaded);
            const readDid = `did:fabric:user${readIndex}`;

            const isAnchorRead = Math.random() < 0.5;
            
            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: isAnchorRead ? 'readAnchor' : 'getClientData',
                invokerIdentity: identity.invoker,
                contractArguments: isAnchorRead ? [readDid] : [readDid, "did,status"],
                readOnly: true
            });
        } 

        // --- 30% WRITE OPERATIONS ---
        else {
            // Use unique DIDs for writes to avoid MVCC conflicts
            const globalWriteIndex = this.writeOffset + this.txIndex;
            const writeDid = `did:fabric:user${globalWriteIndex}`;

            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: identity.ledgerUser }
            };

            const hash = crypto.createHash('sha256')
                .update(`credential-${globalWriteIndex}`)
                .digest('hex');

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'anchorCredential',
                invokerIdentity: identity.invoker,
                contractArguments: [JSON.stringify(client), hash],
                readOnly: false
            });
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
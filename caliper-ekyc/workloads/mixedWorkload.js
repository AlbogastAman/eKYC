'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class MixedWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        // Match settings from createClient.js and YAML
        this.runID = this.roundArguments.seed;
        this.totalPreloaded = this.roundArguments.totalAssets || 10000;
        this.assetsPerWorker = Math.floor(this.totalPreloaded / this.totalWorkers);
        
        this.txIndex = 0;
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;
        const random = Math.random();

        // --- 70% READ OPERATIONS ---
        if (random < 0.7) {
            // Pick a random DID from the preloaded pool
            const targetWorker = Math.floor(Math.random() * this.totalWorkers);
            const targetIndex = Math.floor(Math.random() * this.assetsPerWorker) + 1;
            
            const readDid = `did:fabric:usr_${this.runID}_${targetWorker}_${targetIndex}`;

            const isAnchorRead = Math.random() < 0.5;
            
            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: isAnchorRead ? 'readAnchor' : 'getClientData',
                invokerIdentity: this.invoker,
                contractArguments: isAnchorRead ? [readDid] : [readDid, "did,status"],
                readOnly: true
            });
        } 

        // --- 30% WRITE OPERATIONS ---
        else {
            // Create NEW unique DIDs (using a 'mixed' prefix to avoid collision with preload)
            const writeDid = `did:fabric:usr_mixed_${this.runID}_${this.workerIndex}_${this.txIndex}`;

            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: 'FI1', orgNum: 1 }
            };

            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'createClient',
                invokerIdentity: this.invoker,
                contractArguments: [JSON.stringify(client), hash],
                readOnly: false
            });
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
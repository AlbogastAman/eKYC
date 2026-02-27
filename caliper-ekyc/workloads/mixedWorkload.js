'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class MixedWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        
        this.runID = this.roundArguments.seed;
        this.totalPreloaded = this.roundArguments.totalAssets || 10000;
        this.assetsPerWorker = Math.floor(this.totalPreloaded / this.totalWorkers);
        this.invoker = 'FI1';
    }

    async submitTransaction() {
        this.txIndex++;
        const random = Math.random();

        // --- 95% READ OPERATIONS (Light Load) ---
        if (random < 0.95) {
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

        // --- 5% WRITE OPERATIONS (Heavy Load) ---
        else {
            const writeDid = `did:fabric:usr_mixed_${this.runID}_${this.workerIndex}_${this.txIndex}`;
            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: this.invoker, orgNum: 1 }
            };
            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            try {
                return await this.sutAdapter.sendRequests({
                    contractId: 'eKYC',
                    contractFunction: 'createClient', // Adjusted to match your error log
                    invokerIdentity: this.invoker,
                    contractArguments: [JSON.stringify(client), hash],
                    readOnly: false
                });
            } catch (error) {
                // BACKOFF: If a write fails, wait 500ms before allowing this worker to continue
                // This helps clear the Peer/CouchDB backlog
                await new Promise(resolve => setTimeout(resolve, 500));
                throw error; 
            }
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
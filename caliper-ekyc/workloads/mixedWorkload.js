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
        
        this.runID = this.roundArguments.seed || 'STRESS';
        this.totalPreloaded = this.roundArguments.totalAssets || 10000;
        this.invoker = 'FI1';
        
        // Ensure writes start AFTER the preloaded data
        // Each worker gets a "Mixed" lane starting at 10,001
        this.writeOffset = this.totalPreloaded; 
        this.txsPerWorker = 2000; // Buffer space for new writes per worker
    }

    async submitTransaction() {
        this.txIndex++;
        const random = Math.random();

        // --- 95% READS: Targeting the 10k preloaded assets ---
        if (random < 0.95) {
            const randomTarget = Math.floor(Math.random() * this.totalPreloaded) + 1;
            const readDid = `did:fabric:usr_${this.runID}_${randomTarget}`;

            return this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'readAnchor',
                invokerIdentity: this.invoker,
                contractArguments: [readDid],
                readOnly: true
            });
        } 

        // --- 5% WRITES: Creating brand-new unique entries ---
        else {
            // Formula: PreloadTotal + (MyLane) + MyProgress
            const uniqueWriteIndex = this.writeOffset + (this.workerIndex * this.txsPerWorker) + this.txIndex;
            const writeDid = `did:fabric:usr_mixed_${this.runID}_${uniqueWriteIndex}`;
            
            const client = {
                did: writeDid,
                whoRegistered: { ledgerUser: this.invoker, orgNum: 1 }
            };
            const hash = crypto.createHash('sha256').update(writeDid).digest('hex');

            try {
                return await this.sutAdapter.sendRequests({
                    contractId: 'eKYC',
                    contractFunction: 'createClient',
                    invokerIdentity: this.invoker,
                    contractArguments: [JSON.stringify(client), hash],
                    readOnly: false
                });
            } catch (error) {
                // Defensive Backoff for 2 CPU limit
                await new Promise(resolve => setTimeout(resolve, 500));
                throw error;
            }
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
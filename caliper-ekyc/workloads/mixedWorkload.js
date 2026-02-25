'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');

class MixedWorkload extends WorkloadModuleBase {

    async submitTransaction() {

        const random = Math.random();
        const index = this.txIndex % 10000;
        const did = `did:fabric:user${index}`;

        // Rotate identities across workers
        const identities = [
            { invoker: 'admin', ledgerUser: 'FI1' },
            { invoker: 'admin', ledgerUser: 'FI2' }
        ];

        const identity = identities[this.workerIndex % identities.length];

        // 70% READ OPERATIONS
        if (random < 0.7) {

            const readType = Math.random();

            // 50% readAnchor
            if (readType < 0.5) {

                await this.sutAdapter.sendRequests({
                    contractId: 'eKYC',
                    contractFunction: 'readAnchor',
                    invokerIdentity: identity.invoker,
                    contractArguments: [did],
                    readOnly: true
                });

            }
            // 50% getClientData
            else {

                await this.sutAdapter.sendRequests({
                    contractId: 'eKYC',
                    contractFunction: 'getClientData',
                    invokerIdentity: identity.invoker,
                    contractArguments: [
                        did,
                        "did"
                    ],
                    readOnly: true
                });
            }
        }

        // 30% WRITE OPERATIONS
        else {

            const client = {
                did: did,
                whoRegistered: {
                    ledgerUser: identity.ledgerUser
                }
            };

            const hash = crypto
                .createHash('sha256')
                .update(`credential-${index}`)
                .digest('hex');

            await this.sutAdapter.sendRequests({
                contractId: 'eKYC',
                contractFunction: 'anchorCredential',
                invokerIdentity: identity.invoker,
                contractArguments: [
                    JSON.stringify(client),
                    hash
                ],
                readOnly: false
            });
        }
    }
}

module.exports.createWorkloadModule = () => new MixedWorkload();
const { Contract } = require('fabric-contract-api');
const ClientIdentity = require('fabric-shim').ClientIdentity;

const initialClientData = require('../data/initialClientData.json');
const initialFIData = require('../data/initialFIData.json');

class eKYC extends Contract {

    constructor() {
        super();
        this.nextClientId = 1;
        this.nextFiId = 1;
    }

    /**
     *
     * @param {Context} ctx
     * @dev initiate ledger storing initial data
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const clients = initialClientData;
        const fis = initialFIData;

        for (const client of clients) {
            const newClientId = 'CLIENT' + this.nextClientId;
            const whoRegistered = client.whoRegistered.ledgerUser;

            client.docType = 'client';
            await ctx.stub.putState(newClientId, Buffer.from(JSON.stringify(client)));
            console.info('Added <--> ', client);
            this.nextClientId++;

            // Include who registered the client in the list of FI approved
            const clientFiIndexKey = await ctx.stub.createCompositeKey('clientId~fiId', [newClientId, whoRegistered]);
            const fiClientIndexKey = await ctx.stub.createCompositeKey('fiId~clientId', [whoRegistered, newClientId]);
            await ctx.stub.putState(clientFiIndexKey, Buffer.from('\u0000'));
            await ctx.stub.putState(fiClientIndexKey, Buffer.from('\u0000'));
        }

        for (const fi of fis) {
            fi.docType = 'fi';
            await ctx.stub.putState('FI' + this.nextFiId, Buffer.from(JSON.stringify(fi)));
            console.info('Added <--> ', fi);
            this.nextFiId++;
        }

        console.info('============= END : Initialize Ledger ===========');
    }

    /**
     *
     * @private
     * @param {Context} ctx
     * @dev extracting the CA ID
     * @returns {string} CA ID
     */
    getCallerId(ctx) {
        const cid = new ClientIdentity(ctx.stub);
        const idString = cid.getID();
        const idParams = idString.toString().split('::');
        return idParams[1].split('CN=')[1];
    }

    /**
     *
     * @private
     * @param {Context} ctx
     * @param {string} clientId
     * @dev tell if the caller is who registered client parameter
     * @returns {boolean} is who registered or not, return null if client does not exists or does not have data
     */
    async isWhoRegistered(ctx, clientId) {
        const clientAsBytes = await ctx.stub.getState(clientId);
        if (!clientAsBytes || clientAsBytes.length === 0) {
            return null;
        }
        const clientData = JSON.parse(clientAsBytes.toString());
        const callerId = this.getCallerId(ctx);

        return clientData.whoRegistered.ledgerUser === callerId;
    }

    /**
     *
     * @param {Context} ctx
     * @param {object} clientData
     * @dev create a new client
     * @returns {string} new client ID
     */
    async createClient(ctx, clientData) {
        console.info('============= START : Create client ===========');

        clientData = JSON.parse(clientData);
        const callerId = this.getCallerId(ctx);

        if (clientData.whoRegistered.ledgerUser !== callerId) {
            return null;
        }

        const client = {
            docType: 'client',
            ...clientData
        };

        const newId = 'CLIENT' + this.nextClientId;
        this.nextClientId++;

        await ctx.stub.putState(newId, Buffer.from(JSON.stringify(client)));

        // Include who registered the client in the list of FI approved
        const clientFiIndexKey = await ctx.stub.createCompositeKey('clientId~fiId', [newId, callerId]);
        const fiClientIndexKey = await ctx.stub.createCompositeKey('fiId~clientId', [callerId, newId]);
        await ctx.stub.putState(clientFiIndexKey, Buffer.from('\u0000'));
        await ctx.stub.putState(fiClientIndexKey, Buffer.from('\u0000'));

        console.info('============= END : Create client ===========');

        return newId;
    }

    /**
     * @param {Context} ctx
     * @param {string} userDid - The Decentralized Identifier (e.g., did:fabric:AMALB)
     * @param {string} credentialHash - The SHA256 hash of the VC
     */
    async anchorCredential(ctx, userDid, credentialHash) {
        console.info('============= START : Anchor Credential ===========');

        const callerId = this.getCallerId(ctx);

        // Security check: Ensure the caller is authorized
        // (You can add logic here to check if callerId belongs to a verified FI)

        // Get the deterministic timestamp from the transaction context
        const txTimestamp = ctx.stub.getTxTimestamp();
        const createdAt = new Date(txTimestamp.seconds * 1000).toISOString();

        const anchor = {
            docType: 'credentialAnchor',
            did: userDid,
            hash: credentialHash, // Only the proof, no PII
            issuer: callerId,
            status: 'VALID',
            createdAt: createdAt
        };

        // Store the anchor using the DID as the key
        await ctx.stub.putState(userDid, Buffer.from(JSON.stringify(anchor)));

        // Maintain your composite keys so FIs can still see which clients they registered
        const clientFiIndexKey = await ctx.stub.createCompositeKey('clientId~fiId', [userDid, callerId]);
        const fiClientIndexKey = await ctx.stub.createCompositeKey('fiId~clientId', [callerId, userDid]);

        await ctx.stub.putState(clientFiIndexKey, Buffer.from('\u0000'));
        await ctx.stub.putState(fiClientIndexKey, Buffer.from('\u0000'));

        console.info('============= END : Anchor Credential ===========');

        return userDid;
    }

    /**
     *
     * @param {Context} ctx
     * @param {string} clientId
     * @param {Array} fields
     * @dev get specified fields of client data when called by an FI
     * @returns {object} client data as an object
     */
    async getClientData(ctx, clientId, fields) {

        const clientAsBytes = await ctx.stub.getState(clientId);
        if (!clientAsBytes || clientAsBytes.length === 0) {
            return null;
        }

        const clientData = JSON.parse(clientAsBytes.toString());
        const callerId = this.getCallerId(ctx);

        // Check caller is who registered
        if (clientData.whoRegistered.ledgerUser !== callerId) {

            // If caller is not who registered, check if caller is approved
            const relations = await this.getRelationByFi(ctx, callerId);
            if (!relations.includes(clientId)) {
                return null;
            }
        }

        // Get only requested fields
        fields = fields.split(',').map(field => field.trim());

        let result = {};
        for (const field of fields) {
            if (clientData.hasOwnProperty(field)) {
                result[field] = clientData[field];
            }
        }
        return result;
    }

    /**
     *
     * @param {Context} ctx
     * @dev get financial insitution data
     * @returns {object} FI data as an object
     */
    async getFinancialInstitutionData(ctx) {

        const callerId = this.getCallerId(ctx);

        const fiAsBytes = await ctx.stub.getState(callerId);
        if (!fiAsBytes || fiAsBytes.length === 0) {
            return null;
        }

        return fiAsBytes.toString();
    }

    /**
     *
     * @param {Context} ctx
     * @param {string} clientId
     * @param {string} fiId
     * @dev approve FI to access client data
     * @returns {boolean} return true if approved
     */
    async approve(ctx, clientId, fiId) {
        console.info('======== START : Approve financial institution for client data access ==========');

        const res = await this.isWhoRegistered(ctx, clientId);

        if (!res) {
            return false;
        }

        const clientFiIndexKey = await ctx.stub.createCompositeKey('clientId~fiId', [clientId, fiId]);
        const fiClientIndexKey = await ctx.stub.createCompositeKey('fiId~clientId', [fiId, clientId]);

        if (!clientFiIndexKey) {
            throw new Error('Composite key: clientFiIndexKey is null');
        }

        if (!fiClientIndexKey) {
            throw new Error('Composite key: fiClientIndexKey is null');
        }

        await ctx.stub.putState(clientFiIndexKey, Buffer.from('\u0000'));
        await ctx.stub.putState(fiClientIndexKey, Buffer.from('\u0000'));
        console.info('======== END : Approve financial institution for client data access =========');

        return true;
    }

    /**
     *
     * @param {Context} ctx
     * @param {string} clientId
     * @param {Array} fields
     * @dev remove FI access data approval
     * @returns {boolean} return true if removed
     */
    async remove(ctx, clientId, fiId) {
        console.info('======== START : Remove financial institution for client data access ==========');

        if (!this.isWhoRegistered(ctx, clientId)) {
            return false;
        }

        const clientFiIterator = await ctx.stub.getStateByPartialCompositeKey('clientId~fiId', [clientId, fiId]);
        const clientFiResult = await clientFiIterator.next();
        if (clientFiResult.value) {
            await ctx.stub.deleteState(clientFiResult.value.key);
        }

        const fiClientIterator = await ctx.stub.getStateByPartialCompositeKey('fiId~clientId', [fiId, clientId]);
        const fiClientResult = await fiClientIterator.next();
        if (fiClientResult.value) {
            await ctx.stub.deleteState(fiClientResult.value.key);
        }

        console.info('======== END : Remove financial institution for client data access =========');

        return true;
    }

    /**
     *
     * @private
     * @param {Context} ctx
     * @param {Iterator} relationResultsIterator
     * @dev iterate a composite key iterator
     * @returns {Array} list of results of the iteration
     */
    async getRelationsArray(ctx, relationResultsIterator) {
        let relationsArray = [];
        while (true) {

            const responseRange = await relationResultsIterator.next();

            if (!responseRange || !responseRange.value) {
                return JSON.stringify(relationsArray);
            }

            const { attributes } = await ctx.stub.splitCompositeKey(responseRange.value.key);

            relationsArray.push(attributes[1]);
        }
    }

    /**
     *
     * @param {Context} ctx
     * @param {string} clientId
     * @dev get a list of approved FIs
     * @returns {Array} list of approved FIs
     */
    async getRelationByClient(ctx, clientId) {
        if (!this.isWhoRegistered(ctx, clientId)) {
            return null;
        }

        const relationResultsIterator = await ctx.stub.getStateByPartialCompositeKey('clientId~fiId', [clientId]);
        const result = await this.getRelationsArray(ctx, relationResultsIterator);

        return result;
    }

    /**
     *
     * @param {Context} ctx
     * @dev get a list of clients who approved the caller FI
     * @returns {Array} list of clients who approved FI
     */
    async getRelationByFi(ctx) {
        const callerID = this.getCallerId(ctx);

        const relationResultsIterator = await ctx.stub.getStateByPartialCompositeKey('fiId~clientId', [callerID]);
        const result = await this.getRelationsArray(ctx, relationResultsIterator);

        return result;
    }

    /**
     *
     * @param {Context} ctx
     * @dev get a list of all data stored in the ledger
     * @returns {Array} array of data of the ledger
     */
    async queryAllData(ctx) {
        const startKey = '';
        const endKey = '';
        const allResults = [];
        for await (const { key, value } of ctx.stub.getStateByRange(startKey, endKey)) {
            const strValue = Buffer.from(value).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.info(err);
                record = strValue;
            }
            allResults.push({ Key: key, Record: record });
        }
        console.info(allResults);
        return JSON.stringify(allResults);
    }

    /**
       * registerFI registers a FI's Public Identity (DID Document) on the ledger.
       * @param {Context} ctx The transaction context
       * @param {String} fiDid The DID of the FI (e.g., "did:fabric:org1")
       * @param {String} publicKeyJwk The Public Key in JWK string format
       */
    async registerFI(ctx, fiDid, publicKeyJwk) {
        const cid = new ClientIdentity(ctx.stub);

        // 1. CHECK: Is the user an Admin?
        // We check the 'hf.Registrar.Attributes' or look for 'admin' in the Distinguished Name (DN)
        const x509Identifier = cid.getID();
        if (!x509Identifier.toLowerCase().includes('admin')) {
            throw new Error('Unauthorized: Only administrative identities can register a Bank.');
        }

        // 2. CHECK: Does the DID match the caller's MSP?
        // If caller is from Org1MSP, they should only register did:fabric:org1
        const callerMspId = cid.getMSPID(); // e.g., "Org1MSP"
        const expectedOrgSuffix = callerMspId.toLowerCase().replace('msp', ''); // "org1"

        if (!fiDid.endsWith(expectedOrgSuffix)) {
            throw new Error(`Forbidden: ${callerMspId} cannot register a DID for ${fiDid}`);
        }

        // 3. STORAGE: Save the FI Identity (DID Document)
        const fiIdentity = {
            docType: 'fiIdentity',
            did: fiDid,
            mspId: callerMspId,
            publicKeyJwk: JSON.parse(publicKeyJwk),
            status: 'ACTIVE',
            updatedAt: ctx.stub.getTxTimestamp().seconds.low
        };

        // Use the fiDid as the key so it's easily resolvable by other FI
        await ctx.stub.putState(fiDid, Buffer.from(JSON.stringify(fiIdentity)));

        console.info(`FI Registered: ${fiDid}`);
    }

    /**
     * getDidDocument allows FI 2 to resolve F1 1's public key
     */
    async getDidDocument(ctx, did) {
        const dataBytes = await ctx.stub.getState(did);
        if (!dataBytes || dataBytes.length === 0) {
            throw new Error(`The DID Document for ${did} was not found.`);
        }
        return dataBytes.toString();
    }


    /**
 * readAnchor retrieves the credential metadata (hash) for a specific user.
 * @param {Context} ctx The transaction context
 * @param {String} userDid The DID of the user (the key used during anchoring)
 */
    async readAnchor(ctx, userDid) {
        const anchorBytes = await ctx.stub.getState(userDid);

        if (!anchorBytes || anchorBytes.length === 0) {
            throw new Error(`No credential anchor found for user: ${userDid}`);
        }

        const anchor = JSON.parse(anchorBytes.toString());

        // Security check: Ensure this is actually a credential anchor
        if (anchor.docType !== 'credentialAnchor') {
            throw new Error(`The record for ${userDid} is not a valid credential anchor.`);
        }

        // Return the anchor object (containing the hash, issuer, and status)
        return anchor;
    }
}

module.exports = eKYC;

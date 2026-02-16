const { createJWT } = require('did-jwt');
const crypto = require('node:crypto');
const { Wallets } = require('fabric-network');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');
const { derToJose } = require('ecdsa-sig-formatter');
const networkConnection = require('./networkConnection');
const { Resolver } = require('did-resolver');

/**
 * Retrieves the actual Fabric Private Key from the wallet.
 * @param {string} orgNum - The organization number (e.g., 1 or 2).
 * @param {string} ledgerUser - The name of the identity (e.g., 'admin').
 */
const getIssuerKeys = async (orgNumber, ledgerUser) => {
    try {
        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(__dirname, '../wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check to see if we've already enrolled the user.
        const identity = await wallet.get(ledgerUser);

        if (!identity) {
            throw new Error(`Identity ${ledgerUser} not found in wallet`);
        }

        // Fabric identities store keys in 'credentials.privateKey'
        const privateKey = identity.credentials.privateKey;
        const certificate = identity.credentials.certificate;

        return {
            issuerDid: `did:fabric:org${orgNumber}`,
            privateKey: privateKey, // This is the PEM string
            certificate: certificate, // Used to verify the signature later
            mspId: identity.mspId    // e.g., 'Org1MSP'
        };
    } catch (error) {
        throw new Error(`Failed to load issuer keys: ${error.message}`);
    }
};


const createVC = async ({ id, claims, issuer, keys, salts }) => {
    // 1. Load the PEM safely
    const privateKeyObject = crypto.createPrivateKey({
        key: keys.privateKey,
        format: 'pem',
        type: 'pkcs8'
    });

    /**
     * 2. Fixed Signer
     * Node's crypto signs in DER format by default. 
     * We use derToJose to convert it to the format did-jwt needs for ES256.
     */
    const signer = (data) => {
        // const sign = crypto.createSign('SHA256');
        // sign.update(data);
        // sign.end();

        // // Step A: Get the standard DER signature
        // const derSignature = sign.sign(privateKeyObject);

        // // Step B: Convert DER to JOSE (concatenated R and S values)
        // return derToJose(derSignature, 'ES256');


        // Ensure data is a Buffer
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

        // Sign using the private key
        const derSignature = crypto.sign("SHA256", dataBuffer, privateKeyObject);

        // IMPORTANT: ES256 signatures must be exactly 64 bytes (R + S)
        // If your derToJose is custom, ensure it handles the R and S padding correctly
        return derToJose(derSignature, 'ES256');

    };

    // 3. Poseidon Setup (unchanged)
    const poseidon = await buildPoseidon();
    const toBigInt = (str) => str ? BigInt('0x' + Buffer.from(str).toString('hex')) : BigInt(0);

    const dobHash = poseidon.F.toString(poseidon([toBigInt(claims.dateOfBirth), BigInt("0x" + salts.dateOfBirth)]));
    const idHash = poseidon.F.toString(poseidon([toBigInt(claims.idNumber), BigInt("0x" + salts.idNumber)]));
    const countryHash = poseidon.F.toString(poseidon([toBigInt(claims.country), BigInt("0x" + salts.country)]));

    // 4. Build Payload
    const payload = {
        sub: id,
        iss: issuer,
        iat: Math.floor(Date.now() / 1000),
        vc: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "IdentityCredential"],
            "credentialSubject": {
                "id": id,
                "name": claims.name,
                "address": claims.address,
                "zkProofs": {
                    "dateOfBirthHash": dobHash,
                    "idNumberHash": idHash,
                    "countryHash": countryHash
                }
            }
        }
    };

    // 5. Create JWT (alg must be ES256 to match the Fabric key)
    const token = await createJWT(
        payload,
        { issuer: issuer, signer },
        {
            alg: 'ES256',
            typ: 'JWT',
            kid: `${issuer}#key-1`
        }
    );

    return { jwt: token, salts };
};


/**
 * Creates a DID Resolver that uses the Fabric ledger.
 * @param {string} orgNumber - The org performing the query (e.g., '2')
 * @param {string} userName - The identity in the wallet (e.g., 'admin')
 */
const createFabricResolver = (orgNumber, userName) => {

    // Helper to ensure coordinates are Base64URL compliant (no +, /, or =)
    const fixBase64Url = (str) => {
        return str
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    return new Resolver({
        fabric: async (did) => {
            // Use your existing evaluateTransaction utility
            const fiDataBuffer = await networkConnection.evaluateTransaction(
                'getDidDocument',
                orgNumber,
                userName,
                [did] // The DID we are looking up (e.g., "did:fabric:org1")
            );

            const fiDoc = JSON.parse(fiDataBuffer.toString());


            // Ensure x and y are clean Base64URL strings
            const cleanX = fixBase64Url(fiDoc.publicKeyJwk.x);
            const cleanY = fixBase64Url(fiDoc.publicKeyJwk.y);

            // --- ADD LOGS HERE ---
            console.log("--- DEBUGGING RESOLVER ---");
            console.log("DID being resolved:", did);
            console.log("X coordinate:", cleanX);
            console.log("X length:", cleanX.length);
            console.log("Y length:", cleanY.length);
            // ---------------------

            return {
                didDocument: {
                    id: did,
                    verificationMethod: [{
                        id: `${did}#key-1`,
                        type: 'JsonWebKey2020',
                        controller: did,
                        publicKeyJwk: {
                            kty: 'EC',
                            crv: 'P-256',
                            x: cleanX,
                            y: cleanY
                        }
                    }],
                    assertionMethod: [`${did}#key-1`]
                }
            };
        }
    });
};

module.exports = {
    createVC,
    getIssuerKeys,
    createFabricResolver,
};
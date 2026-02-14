const { createJWT, ES256KSigner } = require('did-jwt');
// const crypto = require('node:crypto');
const { Wallets } = require('fabric-network');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');
const crypto = require('crypto');
const { derToJose } = require('ecdsa-sig-formatter');

/**
 * Mock function to retrieve Org-specific Private Keys.
 * In production, these should be in a Secure Vault or HSM.
 */
// const getIssuerKeysMock = async (orgNum) => {
//     // These would typically be loaded from your Fabric Wallet or Environment
//     // For this example, we use a deterministic "secret" based on the org number
//     const privateKey = crypto.createHash('sha256').update(`org${orgNum}_secret_key`).digest('hex');

//     return {
//         issuerDid: `did:fabric:org${orgNum}`,
//         privateKey: privateKey
//     };
// };

/**
 * Retrieves the actual Fabric Private Key from the wallet.
 * @param {string} orgNum - The organization number (e.g., 1 or 2).
 * @param {string} ledgerUser - The name of the identity (e.g., 'admin').
 */
const getIssuerKeys = async (orgNumber, ledgerUser) => {
    try {
        // load the network configuration
        // const ccpPath = path.resolve(__dirname, '..', '..', 'test-network', 'organizations', 'peerOrganizations', `org${orgNumber}.example.com`, `connection-org${orgNumber}.json`);
        // let ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

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
        const sign = crypto.createSign('SHA256');
        sign.update(data);
        sign.end();
        
        // Step A: Get the standard DER signature
        const derSignature = sign.sign(privateKeyObject);
        
        // Step B: Convert DER to JOSE (concatenated R and S values)
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
        { issuer, signer }, 
        { alg: 'ES256' }
    );

    return { jwt: token, salts };
};
module.exports = {
    createVC,
    getIssuerKeys
};
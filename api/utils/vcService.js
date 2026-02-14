const { createJWT, ES256KSigner } = require('did-jwt');
// const crypto = require('node:crypto');
const { Wallets } = require('fabric-network');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');

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


const createVC = async ({ id, claims, issuer, privateKey, salts }) => {
    //const signer = ES256KSigner(keys.privateKey);
    console.log("##### privateKey ", privateKey)
    const signer = ES256KSigner(
        Buffer.from(privateKey, 'hex')
    );
    const poseidon = await buildPoseidon();

    // Helper to convert data to ZK-friendly BigInts
    const toBigInt = (str) => BigInt('0x' + Buffer.from(str).toString('hex'));

    // Create ZK-Commitments for sensitive fields
    // These match the logic inside your .circom circuit
    const dobHash = poseidon.F.toString(
        poseidon([toBigInt(claims.dateOfBirth), BigInt("0x" + salts.dateOfBirth)])
    );
    const idHash = poseidon.F.toString(
        poseidon([toBigInt(claims.idNumber), BigInt("0x" + salts.idNumber)])
    );

    const countryHash = poseidon.F.toString(
        poseidon([toBigInt(claims.country), BigInt("0x" + salts.country)])
    );

    const payload = {
        sub: id,
        iss: issuer,
        iat: Math.floor(Date.now() / 1000),
        vc: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential", "IdentityCredential"],
            "credentialSubject": {
                "id": id,
                "name": claims.name,       // Disclosed (Raw)
                "address": claims.address, // Disclosed (Raw)
                "zkProofs": {
                    "dateOfBirthHash": dobHash, // Hidden (Commitment)
                    "idNumberHash": idHash,     // Hidden (Commitment)
                    "countryHash": countryHash // The commitment Bank B
                }
            }
        }
    };

    const token = await createJWT(payload, { issuer, signer }, { alg: 'ES256K' });

    return { jwt: token, salts };
};

module.exports = {
    createVC,
    getIssuerKeys
};
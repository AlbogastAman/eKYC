const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');
const { pem2jwk } = require('pem-jwk');
const networkConnection = require('./networkConnection');

async function main() {
    // Expected usage: node registerOrg.js <orgName> <adminName> <orgNum>
    const orgName = process.argv[2];
    const adminName = process.argv[3];
    const orgNum = process.argv[4];
    const mspId = `Org${orgNum}MSP`;

    // Simple validation
    if (!orgName || !adminName || !orgNum) {
        console.error('Usage: node registerOrg.js <orgName> <adminName> <orgNum>');
        console.error('Example: node registerOrg.js org1 admin 1');
        process.exit(1);
    }

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), '../wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check to see if we've already enrolled the adminName user.
    const identity = await wallet.get(adminName);
    if (!identity) {
        console.log(`An identity for the admin user "${adminName}" not found in the wallet`);
        return;
    }

    console.log(`An identity for the admin user "${adminName}" already exists in the wallet`);
    const fiDid = `did:fabric:${orgName}`;

    // Path to the Admin certificate for the specified org
    const certPath = path.resolve(
        __dirname, '..', 'test-network', 'organizations', 'peerOrganizations',
        `${orgNum}.example.com`, 'users', `Admin@${orgNum}.example.com`,
        'msp', 'signcerts', 'cert.pem'
    );

    try {
        console.log(`--- Initializing Registration for ${mspId} ---`);

        if (!fs.existsSync(certPath)) {
            throw new Error(`Certificate not found at: ${certPath}`);
        }

        // 1. Convert Certificate to JWK
        const certPem = fs.readFileSync(certPath, 'utf8');
        const jwk = pem2jwk(certPem);

        // Construct the Public Key JWK (Required for did-jwt)
        const publicKeyJwk = JSON.stringify({
            kty: jwk.kty,
            crv: jwk.crv,
            x: jwk.x,
            y: jwk.y
        });

        // 2. Submit to Ledger
        // Uses your existing utility to call the 'registerBank' function in chaincode
        const response = await networkConnection.submitTransaction(
            'registerFI',
            orgNum,     // 1 for Org1, 2 for Org2
            adminName,    // wallet user
            [fiDid, publicKeyJwk]
        );

        console.log(`Successfully registered ${fiDid} on the ledger.`);
        console.log(`Transaction ID: ${response}`);

    } catch (error) {
        console.error(`Registration Failed: ${error.message}`);
        process.exit(1);
    }
}

main();
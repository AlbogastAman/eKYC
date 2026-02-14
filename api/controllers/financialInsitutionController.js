const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const io = require('../db/io');
const networkConnection = require('../utils/networkConnection');
const { createVC, getIssuerKeys } = require('../utils/vcService');
const crypto = require('crypto');

// exports.createClient = (req, res) => {

//     const orgNum = req.orgNum;
//     const ledgerUser = req.ledgerUser;

//     const { login, password, name, dateOfBirth, address, idNumber } = req.body;
//     const clientData = JSON.stringify({ name, dateOfBirth, address, idNumber, whoRegistered: { orgNum, ledgerUser } });

//     networkConnection
//         .submitTransaction('createClient', orgNum, ledgerUser, [clientData])
//         .then(async result => {
//             if (result) {
//                 result = result.toString();
//                 if (result.length > 0) {
//                     await io.clientCreate(login, password, result, JSON.stringify({ orgNum, ledgerUser }));
//                     return res.json({ message: `New client ${result} created`, ledgerId: result });
//                 }
//             }
//             return res.status(500).json({ error: 'Something went wrong' });
//         })
//         .catch((err) => {
//             return res.status(500).json({ error: `Something went wrong\n ${err}` });
//         });
// };

exports.createClient = async (req, res) => {
    const { login, password, name, dateOfBirth, address, country, idNumber } = req.body;
    const { orgNum, ledgerUser } = req;
    try {
        const userDID = `did:fabric:ekyc:${login}`;

        // 1. Enhanced Key Retrieval (Using real Fabric identity)
        const issuerKeys = await getIssuerKeys(orgNum, ledgerUser);

        const signingKey = crypto.createPrivateKey({
            key: issuerKeys.privateKey,
            format: 'pem',
            type: 'pkcs8' // Fabric usually uses PKCS#8
        });

        console.log("#####signingKey", signingKey);
        // 2. Generate Salts for each attribute (Vital for ZKP)
        // These salts MUST be saved in your local DB so the user can generate proofs later!
        const salts = {
            idNumber: crypto.randomBytes(16).toString('hex'),
            dateOfBirth: crypto.randomBytes(16).toString('hex'),
            country: crypto.randomBytes(16).toString('hex')
        };

        // 3. Build the VC with "Blindable" Claims
        const vc = await createVC({
            id: userDID,
            claims: {
                name,
                address,
                // We keep these for the VC, but the ZKP will use the salted versions
                dateOfBirth,
                idNumber,
                country,
            },
            issuer: issuerKeys.issuerDid,
            keys: signingKey,
            salts, // Include salts in the VC metadata
        });

        // 4. Create the Commitment
        // Instead of hashing the whole VC, we hash the signature or a Merkle Root
        const credentialCommitment = crypto.createHash('sha256')
            .update(vc.jwt)
            .digest('hex');

        // 5. Submit to Ledger
        const ledgerResponse = await networkConnection.submitTransaction(
            'anchorCredential',
            userDID, // Function args should match your new Chaincode exactly
            credentialCommitment
        );

        // 6. Save locally (Including the salts!)
        // If you lose the salts, you can never generate a ZKP again.
        const dbMetadata = {
            orgNum,
            ledgerUser,
            accountStatus: 'ACTIVE'
        };
        await io.clientCreate(
            login,
            password,
            userDID,
            JSON.stringify(dbMetadata)
        );

        // 7. Return the "Keys to the Kingdom" to the User
        // The user is now the sole owner of their salts and signed credential.
        return res.json({
            message: `Verifiable Credential issued. Please save your salts securely.`,
            txId: ledgerResponse.toString(),
            did: userDID,
            vc: vcResult.jwt, // The signed JWT
            salts: salts,      // THE USER MUST STORE THESE LOCALLY
            rawClaims: { name, dateOfBirth, address, country, idNumber }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: `Issuance failed: ${err.message}` });
    }
};

exports.login = async (req, res) => {

    const { login, password, userType } = req.body;

    if (!login || !password) {
        return res.status(401).json({ message: 'Invalid login/password' });
    }

    const fi = await User.findOne({
        $and:
            [
                { login },
                { userType }
            ]
    });
    if (!fi) {
        return res.status(401).json({ message: 'Invalid login' });
    }

    const isMatch = await bcrypt.compare(password, fi.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid password' });
    }

    const userJWT = jwt.sign({ login }, process.env.PRIVATE_KEY, { algorithm: 'HS256' });

    return res.json({ userJWT, orgCredentials: fi.orgCredentials });
};

exports.getFiData = (req, res) => {
    networkConnection
        .evaluateTransaction('getFinancialInstitutionData', req.orgNum, req.ledgerUser)
        .then(result => {
            if (result) {
                if (result.length > 0) {
                    return res.json({ fiData: JSON.parse(result.toString()) });
                }
                return res.json({ fiData: result.toString() });
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};

exports.getClientData = (req, res) => {

    const { clientId, fields } = req.query;

    networkConnection
        .evaluateTransaction('getClientData', req.orgNum, req.ledgerUser, [clientId, fields || []])
        .then(result => {
            if (result) {
                if (result.length > 0) {
                    return res.json({ clientData: JSON.parse(result.toString()) });
                }
                return res.json({ clientData: result.toString() });
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};

exports.getApprovedClients = async (req, res) => {
    networkConnection
        .evaluateTransaction('getRelationByFi', req.orgNum, req.ledgerUser)
        .then(result => {
            if (result) {
                if (result.length > 0) {
                    return res.json({ approvedClients: JSON.parse(result.toString()) });
                }
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const io = require('../db/io');
const networkConnection = require('../utils/networkConnection');
const { createVC, getIssuerKeys, createFabricResolver } = require('../utils/vcService');
const crypto = require('node:crypto');
const { verifyJWT } = require('did-jwt');
const NodeCache = require('node-cache');

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

//Caches
const anchorCache = new NodeCache({ stdTTL: 300 });
const clientCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Load key
const vKeyPath = path.join(__dirname, "../build/requirements_check_key.json");
const vKey = JSON.parse(fs.readFileSync(vKeyPath));

// Business Logic Constants
const CURRENT_THRESHOLD = process.env.DOB_THRESHOLD || "20080217";
const TARGET_COUNTRY = process.env.TARGET_COUNTRY || "834";


// exports.createClient = async (req, res) => {
//     const { login, password, name, dateOfBirth, address, country, idNumber } = req.body;
//     const { orgNum, ledgerUser } = req;
//     try {
//         const userDID = `did:fabric:ekyc:${login}`;
//         //All Non-PII to be shared on ledger
//         const clientData = JSON.stringify({ "did": userDID, name, address, whoRegistered: { orgNum, ledgerUser } });

//         // 1. Enhanced Key Retrieval (Using real Fabric identity)
//         const issuerKeys = await getIssuerKeys(`org${orgNum}`);

//         // 2. Generate Salts for each attribute (Vital for ZKP)
//         // These salts MUST be saved in your local DB so the user can generate proofs later!
//         const salts = {
//             idNumber: crypto.randomBytes(16).toString('hex'),
//             dateOfBirth: crypto.randomBytes(16).toString('hex'),
//             country: crypto.randomBytes(16).toString('hex')
//         };

//         // 3. Build the VC with "Blindable" Claims
//         const vcResult = await createVC({
//             id: userDID,
//             claims: {
//                 name,
//                 address,
//                 // We keep these for the VC, but the ZKP will use the salted versions
//                 dateOfBirth,
//                 idNumber,
//                 country,
//             },
//             issuer: issuerKeys.issuerDid,
//             keys: issuerKeys,
//             salts, // Include salts in the VC metadata
//         });
//         // 4. Create the Commitment
//         // Instead of hashing the whole VC, we hash the signature or a Merkle Root
//         const credentialCommitment = crypto.createHash('sha256')
//             .update(vcResult.jwt)
//             .digest('hex');

//         // 5. Submit to Ledger
//         const ledgerResponse = await networkConnection.submitTransaction(
//             'createClient',
//             orgNum,
//             ledgerUser,
//             [clientData, credentialCommitment]
//         );

//         // 6. Save locally (Including the salts!)
//         // If you lose the salts, you can never generate a ZKP again.
//         const dbMetadata = {
//             orgNum,
//             ledgerUser,
//             accountStatus: 'ACTIVE'
//         };
//         await io.clientCreate(
//             login,
//             password,
//             userDID,
//             JSON.stringify(dbMetadata)
//         );

//         // 7. Return the "Keys to the Kingdom" to the User
//         // The user is now the sole owner of their salts and signed credential.
//         return res.json({
//             message: `Verifiable Credential issued. Please save your salts securely.`,
//             txId: ledgerResponse.toString(),
//             did: userDID,
//             vc: vcResult.jwt, // The signed JWT
//             salts: salts,      // THE USER MUST STORE THESE LOCALLY
//             rawClaims: { name, dateOfBirth, address, country, idNumber }
//         });

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ error: `Issuance failed: ${err.message}` });
//     }
// };

exports.createClient = async (req, res) => {
    const { login, password, name, dateOfBirth, address, country, idNumber } = req.body;
    const { orgNum, ledgerUser } = req;

    try {
        const userDID = `did:fabric:ekyc:${login}`;

        // 1. PARALLEL PREPARATION: Crypto & Keys
        // Fetch keys and generate salts while creating the data string
        const [issuerKeys, salts] = await Promise.all([
            getIssuerKeys(`org${orgNum}`),
            {
                idNumber: crypto.randomBytes(16).toString('hex'),
                dateOfBirth: crypto.randomBytes(16).toString('hex'),
                country: crypto.randomBytes(16).toString('hex')
            }
        ]);

        // 2. GENERATE VC (CPU Intensive)
        const vcResult = await createVC({
            id: userDID,
            claims: { name, address, dateOfBirth, idNumber, country },
            issuer: issuerKeys.issuerDid,
            keys: issuerKeys,
            salts,
        });

        const credentialCommitment = crypto.createHash('sha256')
            .update(vcResult.jwt)
            .digest('hex');

        const clientData = JSON.stringify({
            did: userDID,
            name,
            address,
            whoRegistered: { orgNum, ledgerUser }
        });

        // 3. PARALLEL EXECUTION: Ledger Write + Local DB Save
        // We trigger both "I/O" tasks at once.
        const dbMetadata = JSON.stringify({ orgNum, ledgerUser, accountStatus: 'ACTIVE' });

        const [ledgerResponse] = await Promise.all([
            networkConnection.submitTransaction(
                'createClient',
                orgNum,
                ledgerUser,
                [clientData, credentialCommitment]
            ),
            io.clientCreate(login, password, userDID, dbMetadata)
        ]);

        // 4. CACHE WARMING
        // Pre-fill the cache so the subsequent "getClientData" query is instant (0ms)
        const cacheKey = `${userDID}_all`;
        clientCache.set(cacheKey, { did: userDID, name, address });

        return res.json({
            message: `Verifiable Credential issued.`,
            txId: ledgerResponse.toString(),
            did: userDID,
            vc: vcResult.jwt,
            salts: salts,
            rawClaims: { name, dateOfBirth, address, country, idNumber }
        });

    } catch (err) {
        return res.status(500).json({ error: `Issuance failed: ${err.message}` });
    }
};

exports.verifyUserVC = async (req, res) => {
    const { vc, userDid, proof, publicSignals } = req.body;
    const { orgNum: orgNumber, ledgerUser } = req;

    const resolver = createFabricResolver(orgNumber, ledgerUser);

    try {
        // --- Parallelize JWT and Ledger (with Caching) ---
        const cachedAnchor = anchorCache.get(userDid);

        const [verifiedVC, anchorBuffer] = await Promise.all([
            verifyJWT(vc, { resolver }),
            cachedAnchor ? Promise.resolve(cachedAnchor) : networkConnection.evaluateTransaction('readAnchor', orgNumber, ledgerUser, [userDid])
        ]);

        const anchorParsed = JSON.parse(anchorBuffer.toString());
        const vcPayload = verifiedVC.payload.vc;

        const vcHash = crypto.createHash('sha256').update(vc).digest('hex');

        if (anchorParsed.hash !== vcHash) {
            return res.status(401).json({ error: "VC content does not match ledger anchor (Tampered)" });
        }

        if (anchorParsed.status !== 'VALID') {
            return res.status(401).json({ error: "Credential has been revoked" });
        }

        // --- ZKP logic checks ---
        const vcHashes = vcPayload.credentialSubject.zkProofs;

        //  --- Strict Comparison  ---
        const hashesMatch = (
            publicSignals[0] === vcHashes.dateOfBirthHash &&
            publicSignals[1] === vcHashes.idNumberHash &&
            publicSignals[2] === vcHashes.countryHash
        );

        if (!hashesMatch) {
            return res.status(401).json({ error: "Proof doesn't match VC commitments" });
        }

        // --- Check criteria (DOB/Country) ---
        if (publicSignals[3] !== CURRENT_THRESHOLD || publicSignals[4] !== TARGET_COUNTRY) {
            return res.status(401).json({ error: "Proof used incorrect criteria" });
        }

        // --- Proof verification ---
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        if (!isValid) {
            return res.status(401).json({ error: "Violation of eKYC requirements" });
        }

        // -- Save Data access request ---
        io.fiApprovalRequest(ledgerUser, userDid).catch(e => console.error("FI Approval Background Error:", e));

        return res.status(200).json({
            message: "Verification Successful",
            issuer: verifiedVC.issuer,
            claims: vcPayload.credentialSubject,
            verified: true,
        });

    } catch (err) {
        return res.status(401).json({
            error: "Verification failed",
            details: err.message
        });
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

exports.getClientData = async (req, res) => {
    const { clientId, fields } = req.query;
    const { orgNum, ledgerUser } = req;

    // 1. Cache Lookup (The ultimate latency killer)
    const cacheKey = `${clientId}_${fields || 'all'}`;
    const cachedData = clientCache.get(cacheKey);

    if (cachedData) {
        return res.json({ clientData: cachedData, source: 'cache' });
    }

    try {
        // 2. Ledger Query (Optimized call)
        const result = await networkConnection.evaluateTransaction(
            'getClientData',
            orgNum,
            ledgerUser,
            [clientId, fields || ""]
        );

        if (!result || result.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // 3. Efficient Parsing
        const parsedData = JSON.parse(result.toString());

        // 4. Store in Cache before responding
        clientCache.set(cacheKey, parsedData);

        return res.json({
            clientData: parsedData,
            source: 'ledger'
        });

    } catch (err) {
        return res.status(500).json({
            error: 'Failed to retrieve client data from ledger',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
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
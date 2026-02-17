const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const io = require('../db/io');
const networkConnection = require('../utils/networkConnection');
const { createVC, getIssuerKeys, createFabricResolver } = require('../utils/vcService');
const crypto = require('node:crypto');
const { verifyJWT, decodeJWT } = require('did-jwt');
const snarkjs = require('snarkjs');

const fs = require('fs');
const path = require('path');

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
        const issuerKeys = await getIssuerKeys(`org${orgNum}`);

        // 2. Generate Salts for each attribute (Vital for ZKP)
        // These salts MUST be saved in your local DB so the user can generate proofs later!
        const salts = {
            idNumber: crypto.randomBytes(16).toString('hex'),
            dateOfBirth: crypto.randomBytes(16).toString('hex'),
            country: crypto.randomBytes(16).toString('hex')
        };

        // 3. Build the VC with "Blindable" Claims
        const vcResult = await createVC({
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
            keys: issuerKeys,
            salts, // Include salts in the VC metadata
        });
        // 4. Create the Commitment
        // Instead of hashing the whole VC, we hash the signature or a Merkle Root
        const credentialCommitment = crypto.createHash('sha256')
            .update(vcResult.jwt)
            .digest('hex');

        // 5. Submit to Ledger
        const ledgerResponse = await networkConnection.submitTransaction(
            'anchorCredential',
            orgNum,
            ledgerUser,
            [userDID, credentialCommitment]
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

exports.verifyUserVC = async (req, res) => {
    const { vc, userDid, proof, publicSignals } = req.body;
    let orgNumber = req.orgNum;
    let ledgerUser = req.ledgerUser;
    const resolver = createFabricResolver(orgNumber, ledgerUser);

    try {

        // 1. Cryptographic Check using did-jwt
        // This automatically calls the resolver, fetches the key, and checks the signature
        const verifiedVC = await verifyJWT(vc, { resolver });
        console.log("##verifiedVC##", verifiedVC)

        // 2. Ledger Anchoring Check
        // We hash the incoming VC string to compare it with the proof on the ledger
        const vcHash = crypto.createHash('sha256').update(vc).digest('hex');
        // Query your existing anchor login
        const anchor = await networkConnection.evaluateTransaction('readAnchor', orgNumber, ledgerUser, [userDid]);

        let anchorParsed = JSON.parse(anchor.toString());
        if (anchorParsed.hash !== vcHash) {
            return res.status(401).json({ error: "VC content does not match ledger anchor (Tampered)" });
        }

        if (anchorParsed.status !== 'VALID') {
            return res.status(401).json({ error: "Credential has been revoked" });
        }

        //ZK Proofs - Check requirements

        //1. Cross-check against your Verified VC
        const vcHashes = verifiedVC.payload.vc.credentialSubject.zkProofs;
        const hashesMatch = (
            publicSignals[0] === vcHashes.dateOfBirthHash &&
            publicSignals[1] === vcHashes.idNumberHash &&
            publicSignals[2] === vcHashes.countryHash
        );

        if (!hashesMatch) return res.status(401).json({ error: "Proof doesn't match VC commitments" });

        //https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
        // 2. Cross-check against your business requirements
        const currentThreshold = process.env.DOB_THRESHOLD || "20080217"; // Age 18 check
        const targetCountry = process.env.TARGET_COUNTRY || "834";         // e.g. Tanzania

        if (publicSignals[3] !== currentThreshold || publicSignals[4] !== targetCountry) {
            return res.status(401).json({ error: "Proof used incorrect criteria" });
        }

        // 3. Mathematical check

        // Load the Verification Key ONCE at startup to save resources
        const vKeyPath = path.join(__dirname, "../build/requirements_check_key.json");
        console.log("####vKeyPath #### ", vKeyPath);
        const vKey = JSON.parse(fs.readFileSync(vKeyPath));

        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        if (!isValid) {
            return res.status(401).json({ error: "Violation of eKYC requirements" });
        }

        //Approve relation: FI to Client

        // const { fiId } = req.body;

        // let linkFItoClient = await networkConnection
        //     .submitTransaction('approve', orgNumber, ledgerUser, [req.cookies.ledgerId, fiId])

        // console.log("###linkFItoClient ##", linkFItoClient)

        res.status(200).json({
            message: "Verification Successful",
            issuer: verifiedVC.issuer,
            claims: verifiedVC.payload.vc.credentialSubject,
            verified: true,
        });

    } catch (err) {
        console.error('Verification Error:', err);
        res.status(401).json({ error: "Invalid Signature or DID resolution failed" });
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
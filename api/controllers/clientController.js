const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const networkConnection = require('../utils/networkConnection');

const io = require('../db/io');

exports.login = async (req, res) => {

    const { login, password, userType } = req.body;

    if (!login || !password) {
        return res.status(401).json({ message: 'Invalid login/password' });
    }

    const client = await User.findOne({
        $and:
            [
                { login },
                { userType }
            ]
    });
    if (!client) {
        return res.status(401).json({ message: 'Invalid login' });
    }

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid password' });
    }

    const userJWT = jwt.sign({ login }, process.env.PRIVATE_KEY, { algorithm: 'HS256' });

    return res.json({ userJWT, ledgerId: client.ledgerId, whoRegistered: client.whoRegistered });
};

exports.getClientData = (req, res) => {

    const fields = ['name', 'address', 'dateOfBirth', 'idNumber', 'whoRegistered'];

    networkConnection
        .evaluateTransaction('getClientData', req.orgNum, req.ledgerUser, [req.cookies.ledgerId, fields || []])
        .then(result => {
            if (result) {
                if (result.length > 0) {
                    return res.json({ clientData: JSON.parse(Buffer.from(result.toString())) });
                }
                return res.json({ clientData: result.toString() });
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};

exports.getClientRequests = async (req, res) => {
    try {
        // We 'await' the result directly from the controller
        const data = await io.getRequestsByClient(req.params.did);
        console.log("####data");
        // If it succeeds, send the JSON response
        return res.json(data);
    } catch (err) {
        // If the controller 'throws' an error, it ends up here
        console.error("Route Error:", err);
        return res.status(500).send(err.message || "Internal Server Error");
    }
};

exports.approve = async (req, res) => {

    const { fiId } = req.body;
    const { reqId } = req.params;

    networkConnection
        .submitTransaction('approve', req.orgNum, req.ledgerUser, [req.cookies.ledgerId, fiId])
        .then(async result => {
            if (result) {
                await io.approveIdentityRequest(reqId);
                return res.json({ message: `Financial Institution ${fiId} approved by ${req.cookies.ledgerId}` });
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};

exports.remove = async (req, res) => {

    const { fiId } = req.body;

    if (req.ledgerUser === fiId) {
        return res.status(202).json({ message: 'Cannot remove who registered you' });
    }

    networkConnection
        .submitTransaction('remove', req.orgNum, req.ledgerUser, [req.cookies.ledgerId, fiId])
        .then(result => {
            if (result) {
                return res.json({ message: `Financial Institution ${fiId} removed by ${req.cookies.ledgerId}` });
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};

exports.getApprovedFis = async (req, res) => {
    networkConnection
        .evaluateTransaction('getRelationByClient', req.orgNum, req.ledgerUser, [req.cookies.ledgerId])
        .then(result => {
            if (result) {
                if (result.length > 0) {
                    return res.json({ approvedFis: JSON.parse(result.toString()) });
                }
            }
            return res.status(500).json({ error: 'Something went wrong' });
        })
        .catch((err) => {
            return res.status(500).json({ error: `Something went wrong\n ${err}` });
        });
};
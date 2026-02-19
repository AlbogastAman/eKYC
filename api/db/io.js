const User = require('../models/user');
const FIRequest = require('../models/fiRequests');

exports.clientCreate = async function (login, password, ledgerId, whoRegistered) {
    const newClient = new User({
        login,
        password,
        ledgerId,
        whoRegistered
    });

    newClient.save(function (err) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('New client: ' + newClient.login);
    });
};

exports.fiCreate = async function (login, password, ledgerId, ledgerUser, orgNum) {
    const newFi = new User({
        login,
        password,
        ledgerId,
        ledgerUser,
        orgNum
    });

    newFi.save(function (err) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('New fi: ' + newFi.login);
    });
};

// Create a new request
exports.fiApprovalRequest = async function (fi, client) {
    try {
        const newRequest = new FIRequest({
            fi,
            client,
            approved: 'N'
        });

        // We "await" the result. Execution pauses here until DB is done.
        const savedRequest = await newRequest.save();

        console.log('New Identity Request created for: ' + savedRequest.client);
        return savedRequest;
    } catch (err) {
        console.error('Error creating request:', err);
        throw err; // Re-throw so the caller can handle the error
    }
};

// Get requests for a specific client
exports.getRequestsByClient = async function (clientDid) {
    try {
        const requests = await FIRequest.find({ client: clientDid });
        console.log(`Found ${requests.length} requests for: ${clientDid}`);
        return requests;
    } catch (err) {
        console.error('Error fetching requests:', err);
        throw err;
    }
};

// Update a request to Approved
exports.approveIdentityRequest = async function (requestId) {
    try {
        const updatedRequest = await FIRequest.findByIdAndUpdate(
            requestId,
            { approved: 'Y' },
            { new: true }
        );

        if (!updatedRequest) throw new Error('Request not found');

        console.log(`Request ${requestId} approved.`);
        return updatedRequest;
    } catch (err) {
        console.error('Error updating request:', err);
        throw err;
    }
};
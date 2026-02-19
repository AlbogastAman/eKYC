const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequestSchema = new Schema(
    {
        fi: {
            type: String,
            required: true,
            trim: true
        },
        client: {
            type: String,
            required: true,
            index: true // Optimized for searching user requests
        },
        approved: {
            type: String,
            required: true,
            enum: ['Y', 'N'], // Restricts values to only Y or N
            default: 'N'
        },
        // Optional: Store the public signals from the ZK proof for audit
        publicSignals: {
            type: [String],
            required: false
        }
    },
    {
        timestamps: true // Automatically creates createdAt and updatedAt fields
    }
);

// Create the Model
const FIApprovalRequest = mongoose.model('ApprovalRequest', RequestSchema);

module.exports = FIApprovalRequest;
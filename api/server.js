const app = require('./app');

const InitiateMongoServer = require('./db/connection');
const mongoURI = process.env.MONGODB_URI_DEV;

InitiateMongoServer(mongoURI);

let PORT =process.env.PORT_API||5000;
app.listen(PORT,() => {
    console.log(`🚀 eKYC Service running on port ${PORT}`);
});

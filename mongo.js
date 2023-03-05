const { MongoClient } = require("mongodb");

async function connectMongo() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017')
    return client.db('flowee')
}

module.exports = connectMongo
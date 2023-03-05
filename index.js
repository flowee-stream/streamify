require('dotenv').config()
const { ObjectId } = require('mongodb')
const NodeMediaServer = require('node-media-server')
const connectMongo = require('./mongo')

const config = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: process.env.WEB_PORT,
        allow_origin: '*'
    },
    auth: {
        api: true,
        api_user: process.env.WEBPANEL_USER,
        api_pass: process.env.WEBPANEL_PASS,
    }
}

var nms = new NodeMediaServer(config)

function getAccountIDFromPath(streamPath) {
    return streamPath.replace('/live/', '')
}

nms.on('prePublish', async (id, streamPath, args) => {
    let session = nms.getSession(id)

    let accountID = getAccountIDFromPath(streamPath)
    let token = args.t

    if(!token) {
        session.reject()
        return
    }
    if(accountID.length != 24) {
        session.reject()
        return
    }

    const db = await connectMongo()

    let account = await db.collection('accounts').findOne({
        _id: new ObjectId(accountID),
        streamToken: token
    })
    if(!account) {
        session.reject()
        return
    }

    await db.collection('accounts').updateOne({
        _id: new ObjectId(accountID),
        streamToken: token
    }, {
        $set: {
            isStreaming: true,
            streamURL: process.env.WEB_HOST + streamPath + '.flv',
            lastStream: Math.floor(Date.now() / 1000)
        }
    })

    console.log(accountID + ' started new stream')
})

nms.on('donePublish', async (id, streamPath, args) => {
    let session = nms.getSession(id)

    let accountID = getAccountIDFromPath(streamPath)
    let token = args.t

    if(!token) {
        session.reject()
        return
    }
    if(accountID.length != 24) {
        session.reject()
        return
    }

    const db = await connectMongo()

    let account = await db.collection('accounts').findOne({
        _id: new ObjectId(accountID),
        streamToken: token
    })
    if(!account) {
        session.reject()
        return
    }

    await db.collection('accounts').updateOne({
        _id: new ObjectId(accountID),
        streamToken: token
    }, {
        $set: {
            isStreaming: false
        }
    })

    console.log(accountID + ' ended stream')
})

nms.on('prePlay', async (id, streamPath, args) => {
    let accountID = getAccountIDFromPath(streamPath)

    const db = await connectMongo()

    await db.collection('accounts').updateOne({
        _id: new ObjectId(accountID),
    }, {
        $inc: {
            views: 1
        }
    })

    console.log('Added 1 view to a ' + accountID + ' stream')
})

nms.on('donePlay', async (id, streamPath, args) => {
    let accountID = getAccountIDFromPath(streamPath)

    const db = await connectMongo()

    await db.collection('accounts').updateOne({
        _id: new ObjectId(accountID),
    }, {
        $inc: {
            views: -1
        }
    })

    console.log('Removed 1 view of a ' + accountID + ' stream')
})

nms.run()
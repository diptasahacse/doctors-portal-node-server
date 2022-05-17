const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gubcr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// client.connect(err => {
//     const collection = client.db("test").collection("devices");
//     // perform actions on the collection object
//     client.close();
// });
const run = async () => {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const servicesArray = await cursor.toArray()
            res.send(servicesArray)


        })

    }
    finally {
        // await client.close();

    }

}
run().catch(console.dir)





app.get('/', (req, res) => {
    res.send('Doctors Portal is Ready')
})

app.listen(port, () => {
    console.log(`Doctors Portal is listening on port ${port}`)
})
const express = require('express');
const jwt = require('jsonwebtoken')
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
        const bookingCollection = client.db('doctors_portal').collection('booking');
        const usersCollection = client.db('doctors_portal').collection('users');

        // Get All Treatment Service
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const servicesArray = await cursor.toArray()
            res.send(servicesArray)


        })
        // PUT - USER
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;

            const user = req.body;
            const filter = { email };
            const options = { upsert: true };

            const userDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, userDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token })

        })
        // GET Booking
        app.get('/treatmentbooking', async (req, res) => {
            const patientEmail = req.query.patientEmail;
            const query = { patientEmail }
            const bookedInfoArray = await bookingCollection.find(query).toArray();
            res.send(bookedInfoArray)


        })
        // POST Booking
        app.post('/treatmentbooking', async (req, res) => {
            const bookingData = req.body;
            // console.log(bookingData)
            // Make query if already that service exist
            const query = {
                patientEmail: bookingData.patientEmail,
                treatmentName: bookingData.treatmentName,
                date: bookingData.date
            }
            const exist = await bookingCollection.findOne(query);
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            else {
                const result = await bookingCollection.insertOne(bookingData);
                return res.send({ success: true, result })

            }

        })
        // Get Available services
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // get all services
            const services = await servicesCollection.find().toArray();

            // get the booking of that day
            const query = { date };
            const bookings = await bookingCollection.find(query).toArray();

            // Step: 3 -- for each service
            services.forEach(service => {
                // Step 4 : find booking for that service
                const serviceBookings = bookings.filter(b => b.treatmentName === service.name)
                // Step 5: select slot for the service booking : ['','','','']
                const bookedSlots = serviceBookings.map(book => book.slot)


                // Step : 5 -- select those slots that are not in bookedSlots
                const available = service.slots.filter(singleSlot => !bookedSlots.includes(singleSlot))

                // Step -6 -- replace slots as a obj property in each service
                service.slots = available
            })

            // console.log(req.query)

            res.send(services)


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
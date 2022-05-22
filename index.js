const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_KEY);
const port = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

const calculateOrderAmount = (items) => {
    // Replace this constant with a calculation of the order's amount
    // Calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    // return 1400;
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gubcr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// client.connect(err => {
//     const collection = client.db("test").collection("devices");
//     // perform actions on the collection object
//     client.close();
// });

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Token ঠিক নাই বা আন্ডিফাইন্ড হলে
    if (!authHeader) {
        return res.status(401).send({
            message: 'Unauthorized access'
        })

    }
    // টোকেন আছে কিন্তু ঠিক টোকেন কিনা
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

        // যদি এরর হয় তাহলে বুজতে হবে টোকেন আছে কিন্তু পারমিশন বা এক্সেস নাই
        if (err) {
            return res.status(403).send({
                message: 'Forbidden access 1'
            })

        }
        // যদি এরর না হয় তাহলে বুজতে হবে টোকেন আছে তাই req.decoded এর মান decoded এর ভ্যালু বসিয়ে দিতে হবে
        req.decoded = decoded;

        // সব শেষে এই middleware টি যেখানে ইউজ হয়েছে সেখানে ফেরত যাওয়ার জন্য next function কে কল করে দিতে হবে।
        next();




    });
}


const run = async () => {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('booking');
        const usersCollection = client.db('doctors_portal').collection('users');
        const doctorsCollection = client.db('doctors_portal').collection('doctors');
        const paymentsCollection = client.db('doctors_portal').collection('payments');


        const verifyAdmin = async (req, res, next) => {
            const requesterEmail = req.decoded.email;
            const requesterInfo = await usersCollection.findOne({ email: requesterEmail })
            if (requesterInfo.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({
                    message: 'Forbidden access'
                })

            }


        }
        // Get All Doctors
        app.get('/alldoctors', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = doctorsCollection.find(query);
            const doctorsArray = await cursor.toArray()
            res.send(doctorsArray)

        })
        // Get All Treatment Service
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const servicesArray = await cursor.toArray()
            res.send(servicesArray)


        })
        // Get All Treatment Service name
        app.get('/servicesname', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({ name: 1 });
            const servicesArray = await cursor.toArray()
            res.send(servicesArray)


        })
        // GET -  all user
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users)

        })
        // admin status
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })

        })
        // make to create an admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email };
            const userDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, userDoc);

            return res.send(result)


        })
        // remove admin
        app.put('/user/removeadmin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;

            const filter = { email };
            const userDoc = {
                $unset: { role: '' },
            };
            const result = await usersCollection.updateOne(filter, userDoc);

            return res.send(result)


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
        app.get('/treatmentbooking', verifyJWT, async (req, res) => {
            // const token = req.headers.authorization.split(' ')[1];
            // console.log(req.headers.authorization)

            const patientEmail = req.query.patientEmail;

            // যদি কারো কাছে অন্য কারো ভ্যালিড টোকেন থাকে তাহলে যা যাতে অন্যের ইনফো দেখতে না পারে তার জন্য decode email আর patient email একই কিনা সেটা চেক করতে হবে। যদি ঠিক থাকে তাহলে তাকে ডাটা দিবো না হবে ফরবিডেন করে দিবো
            const decodeEmail = req.decoded.email;
            if (patientEmail === decodeEmail) {
                const query = { patientEmail }
                const bookedInfoArray = await bookingCollection.find(query).toArray();
                return res.send(bookedInfoArray)
            }
            else {
                return res.status(403).send({
                    message: 'Forbidden access 2'
                })

            }


        })
        // Get single booking
        app.get('/treatmentbooking/:id', verifyJWT, async (req, res) => {
            const bookingId = req.params.id;
            const query = { _id: ObjectId(bookingId) };

            const bookingInfo = await bookingCollection.findOne(query);
            res.send(bookingInfo)

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
        // booking treatment update for payment
        app.patch('/treatmentbooking/:id', verifyJWT, async (req, res) => {
            const bookingId = req.params.id;
            const query = { _id: ObjectId(bookingId) };
            const payment = req.body;

            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId

                }
            }


            const updatedResult = await bookingCollection.updateOne(query, updatedDoc);
            const paymentResult = await paymentsCollection.insertOne(payment);
            res.send(updatedResult)

        })
        // Doctor
        app.post('/addDoctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctorInfo = req.body;
            const result = await doctorsCollection.insertOne(doctorInfo)
            res.send(result)


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
        // GET all Payment data for a particular user
        app.get('/payment/:email', async (req, res) => {
            const email = req.params.email;
            const query = { patientEmail: email }
            const paymentInfo = await paymentsCollection.find(query).toArray();
            res.send(paymentInfo);


        })



        // delete an Doctor
        app.delete('/alldoctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const doctorsId = req.params.id;
            const query = { _id: ObjectId(doctorsId) };
            const result = await doctorsCollection.deleteOne(query);
            res.send(result)

        })



        // Payment
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            // console.log(paymentIntent)

            res.send({
                clientSecret: paymentIntent.client_secret
            })

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
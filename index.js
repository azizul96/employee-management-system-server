require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.13lfhki.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const serviceCollection = client.db("EMDB").collection("services");
    const userCollection = client.db("EMDB").collection("users");
    const workCollection = client.db("EMDB").collection("works");
    const paymentCollection = client.db("EMDB").collection("payments");

    // middleware
    const verifyToken = (req, res, next) => {
      // console.log('inside verify Token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized " });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized " });
        }
        req.decoded = decoded;
        next();
      });
    };

    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });


    // service
    app.get('/services', async(req, res)=>{
      const result = await serviceCollection.find().toArray()
      res.send(result)
    })

    // users
    app.get('/users', async(req, res)=>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.get('/users/:id', verifyToken, async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await userCollection.findOne(filter)
      res.send(result)
    })
    app.get('/users/admin/:email', verifyToken, async(req, res)=>{
      const email = req.params.email
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'Unauthorized'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let admin = false
      if(user){
        admin = user?.designation === 'admin'
      }
      res.send({admin});
    })
    app.get('/users/hr/:email', verifyToken, async(req, res)=>{
      const email = req.params.email
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'Unauthorized'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let hr = false
      if(user){
        hr = user?.designation === 'hr'
      }
      res.send({hr});
    })

    app.get('/users/employee/:email', verifyToken, async(req, res)=>{
      const email = req.params.email
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'Unauthorized'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let employee = false
      if(user){
        employee = user?.designation === 'employee'
      }
      res.send({employee});
    })

    app.post('/users', async(req, res)=>{
      const user = req.body
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
        return res.send({message: 'user already exists'})
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.patch('/users/hr/:id', async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const existingUser = await userCollection.findOne(filter);
      // if (!existingUser) {
      //   return res.status(404).send('User not found');
      // }
      const updatedStatus = !existingUser.status;
      const updatedDoc = {
        $set: {
          status: updatedStatus
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })
    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          designation: 'hr'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch('/users/fired/:id', async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const existingUser = await userCollection.findOne(filter);
      
      const updatedDoc = {
        $set: {
          fired: true
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/users/:id', verifyToken, async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(filter)
      res.send(result)
    })

    // work
    app.get('/works',  async(req, res)=>{
      const result = await workCollection.find().sort({ createdAt: -1 }).toArray()
      res.send(result)
    })
    app.post('/works', async(req, res)=>{
      const work = req.body
      const result = await workCollection.insertOne(work)
      res.send(result)
    })

    // Payment intent
    app.post("/create-payment-intent", async (req, res) =>{
      const {salary} = req.body;
      const amount = parseInt(salary * 100)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      });
    })
    // Payment
    app.get('/payments', async(req, res)=>{
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })

    app.post('/payments', async(req, res)=>{
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)
      res.send(result)
    })
    
    
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Employee Management App successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Employee Management App Running...!");
});

app.listen(port, () => {
  console.log(`Employee Management App Running on port ${port}`);
});

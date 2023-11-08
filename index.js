const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

// middleware
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9wwku4y.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware own created
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

const logger = async (req, res, next) => {
  console.log('called', req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('value of token in middleware', token);
  if (!token) {
    return res.status(401).send({ message: 'not authorized' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    //error
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'unauthorized' });
    }
    // if token is valid then it would be decoded
    console.log('value in the token', decoded);
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const jobsCollection = client.db('skillSwapr').collection('allJobs');
    const bidedJobsCollection = client.db('skillSwapr').collection('bidedJobs');

    // auth related api
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      // node
      // require('crypto').randomBytes(64).toString('hex')
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          sameSite: 'none',
          secure: true,
        })
        .send({ success: true });
    });

    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true });
    });

    // jobs related api
    // get all jobs by filter
    app.get('/jobs', logger, async (req, res) => {
      let queryObj = {};
      let sortObj = {};

      // filter sort
      const category = req?.query?.category;
      const sortField = req?.query?.sortField;
      const sortOrder = req?.query?.category;

      // pagination

      if (category) {
        queryObj.category = category;
      }
      console.log(category);

      const result = await jobsCollection.find(queryObj).toArray();
      res.send(result);
    });

    // post job
    app.post('/jobs', logger, async (req, res) => {
      try {
        const jobInfo = req.body;
        const result = await jobsCollection.insertOne(jobInfo);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // delete a single job
    app.delete('/job/:id', logger, async (req, res) => {
      try {
        const id = req.params.id;
        const query = {
          _id: new ObjectId(id),
        };
        const result = await jobsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get jobs by user email
    app.get('/jobs/:email', logger, verifyToken, async (req, res) => {
      try {
        const userEmail = req.params.email;
        if (userEmail === req.user.email) {
          const query = {
            email: userEmail,
          };
          const result = await jobsCollection.find(query).toArray();
          res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // get individual job
    app.get('/jobDetails/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const jobDetails = await jobsCollection.findOne(query);
      res.send(jobDetails);
    });

    // update a single job
    app.put('/update-job/:id', logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const filter = {
        _id: new ObjectId(id),
      };
      const options = { upsert: true };
      const updatedData = {
        $set: {
          jobTitle: data.jobTitle,
          deadline: data.deadline,
          description: data.description,
          category: data.category,
          minimumPrice: data.minimumPrice,
          maximumPrice: data.maximumPrice,
        },
      };

      const result = await jobsCollection.updateOne(
        filter,
        updatedData,
        options
      );

      res.send(result);
    });

    // Post a single bided job of all user
    app.post('/bidedJob', async (req, res) => {
      try {
        const bidedJob = req.body;
        const result = await bidedJobsCollection.insertOne(bidedJob);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // get bidedJobs by bidder email
    app.get('/bidedJobs/:email', logger, verifyToken, async (req, res) => {
      try {
        const biderEmail = req.params.email;
        if (biderEmail === req.user.email) {
          const query = {
            biddersEmail: biderEmail,
          };
          const result = await bidedJobsCollection.find(query).toArray();
          res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // get bidedJobs by bidder email
    app.get('/requestedJobs/:email', logger, verifyToken, async (req, res) => {
      try {
        const biderEmail = req.params.email;
        if (biderEmail === req.user.email) {
          const query = {
            buyerEmail: biderEmail,
          };
          const result = await bidedJobsCollection.find(query).toArray();
          res.send(result);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // upsert bidedJobsCollection by verifyingToken
    app.patch('/updateBidedJobs/:id', logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const filter = {
        _id: new ObjectId(id),
      };
      const options = { upsert: true };
      const updatedData = {
        $set: {
          status: data?.status,
        },
      };

      const result = await bidedJobsCollection.updateOne(
        filter,
        updatedData,
        options
      );
      console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('skillSwapr is running');
});

app.listen(port, () => {
  console.log(`Skill Swapr Server is running on port ${port}`);
});

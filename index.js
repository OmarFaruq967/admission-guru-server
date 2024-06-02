const express = require("express");
const app = express();
const { ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fwbvrwr.mongodb.net/?retryWrites=true&w=majority`;

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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const collegeCollection = client.db("admissionDb").collection("college");
    const usersCollection = client.db("admissionDb").collection("user");
    const admissionsCollection = client
      .db("admissionDb")
      .collection("admission");

    // // API to handle admission form data insertion

    app.post("/admissions", async (req, res) => {
      const data = req.body;
      const collegeId = req.query.collegeId;
      const admission = {
        ...data,
        collegeId: collegeId, // Save collegeId in the admission object
      };
      console.log("Admission object:", admission);
      const result = await admissionsCollection.insertOne(admission);
      console.log("Result:", result);
      res.send({ insertedId: result.insertedId });
    });


    //user save in database
    app.post("/user", async (req, res) => {
    const data = req.body;
    console.log("data", data)
    const existingUser= await usersCollection.findOne({email: data.email})
    if(existingUser){
     return res.status(400).send({messages:"user already exist"});
    }
   else{
    const result = await usersCollection.insertOne(data);
    //  console.log("hit" , result);
     res.send({ insertedId: result.insertedId });
   }
    });

    //admission query by email
    // app.get("/admissions", async (req, res) => {
    //   console.log(req.query.email);
    //   let query = {};
    //   if (req.query?.email) {
    //     query = { email: req.query.email };
    //   }
    //   const result = await admissionsCollection.find(query).toArray();
    //   res.send(result);
    // });

    //admission query by email
    // app.get("/admissions", async (req, res) => {
    //   try {
    //     console.log(req.query.email);
    //     const admission = req.body;
    //     let query = {};
    //     if (req.query?.email) {
    //       query = { email: req.query.email };
    //     }
    //     const result = await admissionsCollection.find(query).toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching admissions:", error);
    //     res.status(500).send("Internal Server Error");
    //   }
    // });

    app.get("/admissions", async (req, res) => {
      try {
        // console.log(req.query.email);
        const admission = req.body;
        let query = {};
        if (req.query?.email) {
          query = { email: req.query.email };
        }
        const admissions = await admissionsCollection.find(query).toArray();

        // Fetch college details for each admission
        const collegeIds = admissions.map((admission) =>
          admission.collegeId?.toString()
        );
        const colleges = await Promise.all(
          collegeIds
            .filter((collegeId) => collegeId) // Filter out undefined or falsy values
            .map(async (collegeId) => {
              const collegeDetails = await fetchCollegeDetails(collegeId);
              return collegeDetails;
            })
        );

        // Combine admission data with college details
        const admissionsWithColleges = admissions.map((admission, index) => ({
          ...admission,
          college: colleges[index],
        }));

        res.send(admissionsWithColleges);
      } catch (error) {
        console.error("Error fetching admissions:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Helper function to fetch college details by collegeId
    const fetchCollegeDetails = async (collegeId) => {
      try {
        const response = await fetch(
          `http://localhost:5000/college/${collegeId}`
        ); // Replace with your actual API endpoint
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching college details:", error);
        throw error;
      }
    };


    //delete admission
    app.delete("/remove/:id", async (req, res) => {
      console.log(req.params);
      const result = await admissionsCollection.deleteOne({ 
        _id: new ObjectId(req.params.id), });
        res.send(result);
    });


    // app.post("/admissions", async (req, res) => {
    //   const data = req.body;
    //   collegeId = data.collegeId;
    //   const admission = {
    //     ...data,
    //     collegeId: collegeId,
    //   };
    //   console.log("Admission object:", admission);
    //   const result = await admissionsCollection.insertOne(admission);
    //   console.log("Result:", result);
    //   res.send({ insertedId: result.insertedId });
    // });

    // app.post("/admissions", async(req, res)=>{
    //   const data= req.body;
    //   const collegeId =req.query.collegeId;
    //   data.collegeId= collegeId;
    //   const admission = {
    //     ...data,
    //     collegeId: collegeId,
    //   };
    //   const result = await admissionsCollection.insertOne(admission);
    //   res.send({insertedId:result.insertedId,});
    // })

    // Save user email and role in DB
    // app.put("/users/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const user = req.body;
    //   const query = { email: email };
    //   const options = { upsert: true };
    //   const updateDoc = {
    //     $set: user,
    //   };
    //   const result = await usersCollection.updateOne(query, updateDoc, options);
    //   res.send(result);
    // });
    // update college data by ID

    app.put("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const adCollegeId = req.body;
        const query = { _id: new ObjectId(email) };
        const options = { upsert: true };
        const admissionCollege = {
          $addToSet: {
            admission: { $each: adCollegeId },
          },
        };
        const result = await usersCollection.updateOne(
          query,
          admissionCollege,
          options
        );
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //College collection API
    app.get("/college", async (req, res) => {
      const result = await collegeCollection.find().toArray();
      res.send(result);
    });

    // View college details by ID
    app.get("/college/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await collegeCollection.findOne(query);
      res.json(result);
    });

    // update college data by ID
    // app.put("/user/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const colleges = req.body;
    //     const query = { _id: new ObjectId(id) };
    //     const options = { upsert: true };
    //     const updateCollege = {
    //       $set: {
    //         admission: true,
    //       },
    //     };
    //     const result = await usersCollection.updateOne(query, updateCollege, options);
    //     res.json(result);
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).json({ error: 'Internal Server Error' });
    //   }
    // });

    // view college details and admission by ID
    app.get("/admission/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await collegeCollection.findOne(query);
      res.send(result);
    });

    


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Admission server is running");
});

app.listen(port, () => {
  console.log(`Admission server is running on port ${port}`);
});

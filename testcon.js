
const mongoose = require('mongoose');
const uri = "mongodb://newpass:pjjUpArLNQH0gzJD@ac-sdhpwtq-shard-00-00.d9ke4mk.mongodb.net:27017,ac-sdhpwtq-shard-00-01.d9ke4mk.mongodb.net:27017,ac-sdhpwtq-shard-00-02.d9ke4mk.mongodb.net:27017/?ssl=true&replicaSet=atlas-h71vtm-shard-0&authSource=admin&appName=Cluster0";

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

async function run() {
  try {
    // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
    await mongoose.connect(uri, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoose.disconnect();
  }
}
run().catch(console.dir);

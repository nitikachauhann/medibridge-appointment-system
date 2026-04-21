// testMongo.js
import mongoose from "mongoose";

// Replace with your actual connection string
const MONGO_URI = "mongodb+srv://doctorapp:Doctor123@cluster0.qixjs1b.mongodb.net/doctorappointment?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected successfully!");
    process.exit(0); // exit script after success
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1); // exit script after failure
  });

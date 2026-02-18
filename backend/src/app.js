import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";

dotenv.config();

const app = express();
const server = createServer(app);
connectToSocket(server);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const PORT = process.env.PORT || 8000;

const start = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Mongo connected DB host: ${connectionDb.connection.host}`);

    server.listen(PORT, () => console.log(`listening on ${PORT}`));
  } catch (err) {
    console.error("Server start error:", err.message);
    process.exit(1);
  }
};

start();

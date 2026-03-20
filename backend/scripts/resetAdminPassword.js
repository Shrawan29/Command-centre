import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const NAME = process.env.ADMIN_NAME || "Admin";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(uri);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await User.findOneAndUpdate(
    { email: EMAIL },
    {
      $set: {
        name: NAME,
        email: EMAIL,
        role: "admin",
        passwordHash,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Admin user ready: ${user.email} (role=${user.role})`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err?.message || err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exitCode = 1;
  });

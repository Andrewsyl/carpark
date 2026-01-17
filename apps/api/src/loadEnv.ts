import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load env files (root and api-local) so STRIPE_SECRET_KEY and others are picked up.
const rootEnv = path.resolve(__dirname, "../../../.env");
const rootEnvLocal = path.resolve(__dirname, "../../../.env.local");
const apiEnv = path.resolve(__dirname, "../.env");
const apiEnvLocal = path.resolve(__dirname, "../.env.local");

// Load in order, allowing later files to override earlier ones.
dotenv.config({ path: rootEnv });
dotenv.config({ path: rootEnvLocal, override: true });
dotenv.config({ path: apiEnv, override: true });
dotenv.config({ path: apiEnvLocal, override: true });

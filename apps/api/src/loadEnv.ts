import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from repo root (three levels up from apps/api/src)
const rootEnv = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnv });

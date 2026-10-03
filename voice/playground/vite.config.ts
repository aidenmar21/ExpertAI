// Voice test bench: `npm run playground -w voice` -> http://localhost:5174
// Serves /api/voice/token with the same handler the app uses, reading keys from app/.env.local or voice/.env.local.
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { voiceTokenRoute } from "../server";

const voiceDir = fileURLToPath(new URL("..", import.meta.url));
const appDir = fileURLToPath(new URL("../../app", import.meta.url));
const KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_INTERVIEWER_AGENT_ID", "ELEVENLABS_TUTOR_AGENT_ID"];

function voiceApi(): Plugin {
  return {
    name: "voice-api",
    configureServer(server) {
      const env = { ...loadEnv("development", appDir, ""), ...loadEnv("development", voiceDir, "") };
      for (const k of KEYS) if (env[k] && !process.env[k]) process.env[k] = env[k];

      server.middlewares.use("/api/voice/health", (_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, Boolean(process.env[k])]))));
      });
      server.middlewares.use("/api/voice/token", async (req, res) => {
        const out = await voiceTokenRoute(new Request(`http://localhost${req.originalUrl ?? req.url}`));
        res.statusCode = out.status;
        res.setHeader("content-type", "application/json");
        res.end(await out.text());
      });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), voiceApi()],
  server: { port: 5174, host: "0.0.0.0", fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});

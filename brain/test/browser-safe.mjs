// Bundles the browser entry (index.ts) for the browser and fails if any server-only code gets in.
import { build } from "esbuild";
const out = await build({ entryPoints: ["index.ts"], bundle: true, platform: "browser", format: "esm", write: false, logLevel: "silent" });
const code = out.outputFiles[0].text;
const banned = { "@anthropic-ai/sdk": /anthropic-ai|new Anthropic|api\.anthropic\.com/, "process.env": /process\.env/, "node: modules": /from ["']node:|require\(["']node:/, "API key": /ANTHROPIC_API_KEY|x-api-key/i };
const hits = Object.entries(banned).filter(([, re]) => re.test(code)).map(([k]) => k);
if (hits.length) { console.error("browser bundle contains:", hits.join(", ")); process.exit(1); }
console.log(`ok browser-safe: index.ts bundles for the browser (${(code.length / 1024).toFixed(1)} KB) with no SDK, env, node: imports, or keys`);

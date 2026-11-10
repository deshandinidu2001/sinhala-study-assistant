import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

// Browser acceptance always uses a disposable database and storage volume.
// Requests from the production frontend are forwarded to this isolated API.
export default async function setup() {
  const cwd = resolve(process.cwd(), "..");
  const suffix = randomUUID().replaceAll("-", "");
  const database = `study_browser_${suffix}`;
  const container = `study-browser-${suffix}`;
  const volume = `study-browser-storage-${suffix}`;
  const docker = (args: string[], env = process.env) => execFileSync("docker", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], timeout: 90_000 }).toString();
  const databaseAction = (statement: string) => docker(["compose", "exec", "-T", "backend", "python", "-c", `from sqlalchemy import create_engine,text; from backend.config import get_settings; e=create_engine(get_settings().database_url,isolation_level='AUTOCOMMIT'); c=e.connect(); c.execute(text('${statement}')); c.close(); e.dispose()`]);
  let databaseCreated = false;
  const cleanup = () => {
    try { docker(["rm", "-f", container]); } catch { /* Container may not have started. */ }
    try { docker(["volume", "rm", volume]); } catch { /* Volume may not have been created. */ }
    if (databaseCreated) databaseAction(`DROP DATABASE "${database}" WITH (FORCE)`);
  };
  try {
    databaseAction(`CREATE DATABASE "${database}"`); databaseCreated = true;
    docker(["compose", "run", "--detach", "--no-deps", "--name", container, "--publish", "127.0.0.1:8001:8000", "--volume", `${volume}:/app/storage`, "--env", "APP_ENV=test", "--env", "GEMINI_API_KEY=", "backend"], { ...process.env, POSTGRES_DB: database });
    for (let attempt = 0; attempt < 45; attempt++) {
      try { if ((await fetch("http://localhost:8001/health")).ok) return cleanup; } catch { /* Waiting for migration and API startup. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error("The isolated test API did not become healthy.");
  } catch (error) { cleanup(); throw error; }
}

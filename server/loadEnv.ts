import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

function resolveEnvPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(currentDir, "..");
  const customPath = process.env.CONFIG_ENV_PATH;

  if (customPath) {
    return path.isAbsolute(customPath)
      ? customPath
      : path.resolve(projectRoot, customPath);
  }

  return path.resolve(projectRoot, "config.env");
}

function setEnvVariable(key: string, value: string) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

function parseAndAssignEnv(content: string) {
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    setEnvVariable(key, value);
  }
}

export function loadEnvironmentConfig(): void {
  if (loaded) {
    return;
  }

  try {
    const envPath = resolveEnvPath();

    if (!fs.existsSync(envPath)) {
      console.warn(`[config] No config.env found at ${envPath}. Using existing environment variables.`);
      loaded = true;
      return;
    }

    const fileContents = fs.readFileSync(envPath, "utf-8");
    parseAndAssignEnv(fileContents);
  } catch (error) {
    console.error("[config] Failed to load config.env", error);
  } finally {
    loaded = true;
  }
}

loadEnvironmentConfig();

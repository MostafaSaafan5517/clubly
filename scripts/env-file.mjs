// Shared by the env:* scripts: sets variables in .env.local, keeping every other line.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const ENV_FILE = ".env.local";

/** Replaces (or appends) the given variables in .env.local; other lines stay as they are. */
export function setEnvValues(values) {
  const existingLines = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, "utf8").split(/\r?\n/)
    : [];
  const keptLines = existingLines.filter((line) => {
    const name = line.split("=")[0]?.trim();
    return !(name && name in values);
  });
  while (keptLines.length > 0 && keptLines.at(-1) === "") {
    keptLines.pop();
  }
  const newLines = Object.entries(values).map(
    ([name, value]) => `${name}=${value}`,
  );
  writeFileSync(ENV_FILE, [...keptLines, ...newLines, ""].join("\n"));
}

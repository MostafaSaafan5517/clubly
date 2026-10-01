// Shared by the env:* scripts: reads and sets variables in .env.local, keeping every other line.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const ENV_FILE = ".env.local";

function readLines() {
  return existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, "utf8").split(/\r?\n/)
    : [];
}

function nameOf(line) {
  return line.split("=")[0]?.trim();
}

/** The value of a variable in .env.local, or undefined if it isn't set. */
export function readEnvValue(name) {
  const line = readLines().find((candidate) => nameOf(candidate) === name);
  const value = line?.slice(line.indexOf("=") + 1).trim();
  return value || undefined;
}

/** Replaces (or appends) the given variables in .env.local; other lines stay as they are. */
export function setEnvValues(values) {
  const keptLines = readLines().filter((line) => {
    const name = nameOf(line);
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

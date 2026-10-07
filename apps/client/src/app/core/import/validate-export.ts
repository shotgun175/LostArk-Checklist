import { EXPORT_FORMAT, LostarkExport, SETTINGS_KEYS } from "./lostark-export";

export interface ExportCounts {
  characters: number;
  tasks: number;
  completion: number;
}

export interface ExportValidation {
  ok: boolean;
  errors: string[];
  counts: ExportCounts;
  data: LostarkExport | null;
}

type JsonObject = Record<string, unknown>;

const REQUIRED_KEYS = ["roster", "settings", "completion", "energy", "tasks"];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickSettings(settings: JsonObject): LostarkExport["settings"] {
  const picked: JsonObject = {};
  Object.entries(settings)
    .filter(([key]) => (SETTINGS_KEYS as string[]).includes(key))
    .forEach(([key, value]) => {
      picked[key] = value;
    });
  return picked as LostarkExport["settings"];
}

/**
 * Checks a parsed export or backup file before anything is written.
 *
 * Rejects a wrong format, missing collections, characters without a truthy id (the roster
 * loader would replace a falsy id with a random one and orphan that character's keys) and
 * tasks without $key. Settings keys this fork does not use are dropped from `data`.
 */
export function validateExport(input: unknown): ExportValidation {
  const errors: string[] = [];
  const counts: ExportCounts = { characters: 0, tasks: 0, completion: 0 };
  if (!isObject(input)) {
    return { ok: false, errors: ["The file is not an export: expected a JSON object."], counts, data: null };
  }

  if (input["format"] !== EXPORT_FORMAT) {
    errors.push(`Unsupported format ${JSON.stringify(input["format"])}, expected ${EXPORT_FORMAT}.`);
  }
  REQUIRED_KEYS
    .filter(key => !(key in input))
    .forEach(key => errors.push(`Missing "${key}".`));

  const roster = input["roster"];
  if ("roster" in input) {
    if (!isObject(roster) || !Array.isArray(roster["characters"])) {
      errors.push('"roster" must be an object with a "characters" list.');
    } else {
      const characters: unknown[] = roster["characters"];
      counts.characters = characters.length;
      characters.forEach((character, index) => {
        if (!isObject(character) || !character["id"]) {
          const name = isObject(character) ? String(character["name"]) : "?";
          errors.push(`Character ${index + 1} (${name}) has no id. Open the Roster page on the source site once, then export again.`);
        }
      });
    }
  }

  const settings = input["settings"];
  if ("settings" in input && !isObject(settings)) {
    errors.push('"settings" must be an object.');
  }

  const completion = input["completion"];
  if ("completion" in input && completion !== null) {
    if (!isObject(completion) || !isObject(completion["data"])) {
      errors.push('"completion" must be null or an object with a "data" map.');
    } else {
      counts.completion = Object.keys(completion["data"]).length;
    }
  }

  const energy = input["energy"];
  if ("energy" in input && energy !== null && (!isObject(energy) || !isObject(energy["data"]))) {
    errors.push('"energy" must be null or an object with a "data" map.');
  }

  const tasks = input["tasks"];
  if ("tasks" in input) {
    if (!Array.isArray(tasks)) {
      errors.push('"tasks" must be a list.');
    } else {
      counts.tasks = tasks.length;
      tasks.forEach((task: unknown, index) => {
        if (!isObject(task) || typeof task["$key"] !== "string" || task["$key"] === "") {
          errors.push(`Task ${index + 1} has no "$key" (document id).`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, counts, data: null };
  }
  return {
    ok: true,
    errors,
    counts,
    data: {
      format: EXPORT_FORMAT,
      exportedAt: String(input["exportedAt"] ?? ""),
      sourceUid: String(input["sourceUid"] ?? ""),
      roster: roster as LostarkExport["roster"],
      settings: pickSettings(settings as JsonObject),
      completion: completion as LostarkExport["completion"],
      energy: energy as LostarkExport["energy"],
      tasks: tasks as LostarkExport["tasks"]
    }
  };
}

export function parseExportFile(text: string): ExportValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."], counts: { characters: 0, tasks: 0, completion: 0 }, data: null };
  }
  return validateExport(parsed);
}

import { AbstractControl, ValidationErrors } from "@angular/forms";
import { createTask, LostarkTask } from "../../model/lostark-task";
import { TaskFrequency } from "../../model/task-frequency";
import { TaskScope } from "../../model/task-scope";

/** The index that puts a new task after the last one. */
export function nextTaskIndex(tasks: Pick<LostarkTask, "index">[]): number {
  const indexes = tasks.map(t => t.index).filter(index => Number.isFinite(index));
  return Math.max(-1, ...indexes) + 1;
}

/** The custom tasks as exported to the clipboard, without the fields that belong to one account (document id, owner, position). */
export function customTasksExport(tasks: LostarkTask[]): Partial<LostarkTask>[] {
  return tasks
    .filter(t => t.custom)
    .map(task => {
      const exported: Partial<LostarkTask> = { ...task };
      delete exported.$key;
      delete exported.authorId;
      delete exported.index;
      return exported;
    });
}

/** Form group check: the minimum item level is not above the maximum (blanks are left to the required check). */
export function ilvlRangeValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get("minIlvl")?.value;
  const max = group.get("maxIlvl")?.value;
  if (min === null || min === undefined || min === "" || max === null || max === undefined || max === "") {
    return null;
  }
  return Number(min) > Number(max) ? { ilvlRange: true } : null;
}

export interface TasksImportResult {
  ok: boolean;
  errors: string[];
  tasks: LostarkTask[];
  skipped: number;
}

const NOT_TASKS = "That does not look like exported custom tasks.";
const ICON_PATH = /^[\w.-]+$/;

function toNumber(value: unknown): number | undefined {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

const duplicateKey = (label: string, frequency: TaskFrequency): string => `${label.trim().toLowerCase()}|${frequency}`;

/**
 * Reads the text pasted into Import custom tasks. It must be a list of objects, each with a label,
 * a known frequency and scope and a numeric minimum item level (maximum item level and repetitions
 * are optional numbers). Nothing is returned unless every entry is valid. Tasks whose label and
 * frequency match an existing task, or an earlier entry, are skipped and counted. The new tasks
 * are custom, owned by uid and placed after the last task.
 */
export function parseTasksImport(text: string, existing: LostarkTask[], uid: string): TasksImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [NOT_TASKS], tasks: [], skipped: 0 };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, errors: [NOT_TASKS], tasks: [], skipped: 0 };
  }
  if (parsed.length === 0) {
    return { ok: false, errors: ["No tasks found."], tasks: [], skipped: 0 };
  }
  const errors: string[] = [];
  const valid: LostarkTask[] = [];
  parsed.forEach((entry: unknown, i) => {
    const label = `Task ${i + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${label} is not a task.`);
      return;
    }
    const raw = entry as Record<string, unknown>;
    const name = typeof raw["label"] === "string" ? raw["label"].trim() : "";
    const frequency = raw["frequency"] as TaskFrequency;
    const scope = raw["scope"] as TaskScope;
    const minIlvl = toNumber(raw["minIlvl"]);
    const maxIlvl = raw["maxIlvl"] === undefined || raw["maxIlvl"] === null ? 9999 : toNumber(raw["maxIlvl"]);
    const amount = raw["amount"] === undefined || raw["amount"] === null ? 1 : toNumber(raw["amount"]);
    const problems: string[] = [];
    if (!name) {
      problems.push("has no name");
    }
    if (typeof frequency !== "number" || TaskFrequency[frequency] === undefined) {
      problems.push("has an unknown frequency");
    }
    if (typeof scope !== "number" || TaskScope[scope] === undefined) {
      problems.push("has an unknown scope");
    }
    if (minIlvl === undefined || maxIlvl === undefined) {
      problems.push("needs numeric item levels");
    }
    if (amount === undefined || amount < 1) {
      problems.push("needs at least 1 repetition");
    }
    if (problems.length > 0) {
      errors.push(`${label}${name ? ` (${name})` : ""} ${problems.join(", ")}.`);
      return;
    }
    const daysFilter = Array.isArray(raw["daysFilter"]) ? raw["daysFilter"].filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    const iconPath = typeof raw["iconPath"] === "string" && ICON_PATH.test(raw["iconPath"]) ? raw["iconPath"] : undefined;
    valid.push(createTask(name, minIlvl as number, frequency, scope, amount, maxIlvl, iconPath, {
      custom: true,
      authorId: uid,
      daysFilter,
      enabled: raw["enabled"] !== false
    }));
  });
  if (errors.length > 0) {
    return { ok: false, errors, tasks: [], skipped: 0 };
  }
  const seen = new Set(existing.map(t => duplicateKey(t.label ?? "", t.frequency)));
  const tasks = valid.filter(task => {
    const key = duplicateKey(task.label, task.frequency);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const firstIndex = nextTaskIndex(existing);
  tasks.forEach((task, i) => task.index = firstIndex + i);
  return { ok: true, errors, tasks, skipped: valid.length - tasks.length };
}

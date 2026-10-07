import * as fs from "fs";
import * as path from "path";
import { parseExportFile } from "./validate-export";
import { FIRESTORE_BATCH_LIMIT, planImportWrites } from "./plan-import-writes";

// A realistic export in the snippet's format: 15 characters (9 hidden), every default task
// plus two custom ones, ticks keyed by character id and task id, rest bonus and gold planner settings.
const FIXTURE_PATH = path.resolve(__dirname, "../../../../../../tools/fixtures/lostark-helper-export-synthetic.json");

describe("synthetic lostark-helper export", () => {
  const validation = parseExportFile(fs.readFileSync(FIXTURE_PATH, "utf8"));

  it("validates and keeps only the settings keys this fork uses", () => {
    expect(validation.errors).toEqual([]);
    expect(validation.counts).toEqual({ characters: 15, tasks: 53, completion: 26 });
    expect(Object.keys(validation.data?.settings || {})).not.toContain("marketRegion");
  });

  it("replaces 51 freshly created default tasks within one batch", () => {
    const freshIds = Array.from({ length: 51 }, (_, i) => `fresh${i}`);
    if (!validation.data) {
      throw new Error("fixture did not validate");
    }
    const writes = planImportWrites("me", freshIds, validation.data);
    expect(writes.filter(w => w.op === "delete")).toHaveLength(51);
    expect(writes.filter(w => w.op === "set" && w.collection === "tasks")).toHaveLength(53);
    expect(writes).toHaveLength(108);
    expect(writes.length).toBeLessThanOrEqual(FIRESTORE_BATCH_LIMIT);
  });
});

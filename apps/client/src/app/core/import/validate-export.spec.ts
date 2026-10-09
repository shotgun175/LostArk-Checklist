import { parseExportFile, validateExport } from "./validate-export";

function sampleExport(): Record<string, unknown> {
  return {
    format: 1,
    exportedAt: "2026-10-07T12:00:00.000Z",
    sourceUid: "source-uid",
    roster: {
      characters: [{ id: 123, name: "Alpha", ilvl: 1640, lazy: false, class: 1, weeklyGold: true }],
      showAllTasks: false,
      trackedTasks: { "123:t1": false }
    },
    settings: {
      hiddenOnCompletion: false,
      crystallineAura: true,
      lazytracking: { "Alpha:t1": false },
      manualGoldEntries: {},
      chestConfiguration: {},
      goldPlannerConfiguration: {},
      raidModesForGoldPlanner: {},
      forceAbyss: {}
    },
    completion: { data: { "123:t1": { amount: 1, updated: 1696676400000 }, t2: { amount: 0, updated: 0 } } },
    energy: { data: { "123:t1": { amount: 20 } }, updated: 1696676400000 },
    tasks: [
      { $key: "t1", label: "Chaos Dungeon", authorId: "source-uid" },
      { $key: "t2", label: "Ghost Ship", authorId: "source-uid" }
    ]
  };
}

describe("validateExport", () => {
  it("keeps a backup's display name, cleaned", () => {
    expect(validateExport({ ...sampleExport(), user: { name: "  Synthetic\u200B Sorc " } }).data?.user).toEqual({ name: "Synthetic Sorc" });
  });

  it("leaves out a missing, blank or malformed display name without blocking the import", () => {
    for (const user of [undefined, null, { name: "   " }, { name: 42 }, "Synthetic Sorc"]) {
      const result = validateExport({ ...sampleExport(), user });
      expect(result.ok).toBe(true);
      expect(result.data && "user" in result.data).toBe(false);
    }
  });

  it("accepts a valid export and counts its content", () => {
    const result = validateExport(sampleExport());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({ characters: 1, tasks: 2, completion: 2 });
    expect(result.data?.roster.characters[0].id).toBe(123);
    expect(result.data?.tasks.map(t => t.$key)).toEqual(["t1", "t2"]);
  });

  it("rejects something that is not an object", () => {
    expect(validateExport(null).ok).toBe(false);
    expect(validateExport([]).ok).toBe(false);
    expect(validateExport("text").data).toBeNull();
  });

  it("rejects a wrong format", () => {
    const file = sampleExport();
    file["format"] = 2;
    const result = validateExport(file);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/format/);
  });

  it("rejects missing collections", () => {
    const file = sampleExport();
    delete file["tasks"];
    delete file["energy"];
    const result = validateExport(file);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing "tasks".');
    expect(result.errors).toContain('Missing "energy".');
  });

  it("rejects a roster without a characters list", () => {
    const file = sampleExport();
    file["roster"] = { showAllTasks: false };
    expect(validateExport(file).ok).toBe(false);
  });

  it("rejects a character whose id is 0", () => {
    const file = sampleExport();
    file["roster"] = { characters: [{ id: 0, name: "Alpha" }], showAllTasks: false, trackedTasks: {} };
    const result = validateExport(file);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Alpha.*no id/);
  });

  it("rejects a character without an id", () => {
    const file = sampleExport();
    file["roster"] = { characters: [{ name: "Beta" }], showAllTasks: false, trackedTasks: {} };
    expect(validateExport(file).errors.join(" ")).toMatch(/Beta.*no id/);
  });

  it("rejects a task without $key", () => {
    const file = sampleExport();
    file["tasks"] = [{ label: "Chaos Dungeon" }];
    const result = validateExport(file);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/\$key/);
  });

  it("drops settings keys this fork does not use", () => {
    const file = sampleExport();
    file["settings"] = { ...(file["settings"] as object), marketRegion: "EU", party: { a: 1 } };
    const result = validateExport(file);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.data?.settings || {}).sort()).toEqual([
      "chestConfiguration", "crystallineAura", "forceAbyss", "goldPlannerConfiguration",
      "hiddenOnCompletion", "lazytracking", "manualGoldEntries", "raidModesForGoldPlanner"
    ]);
    expect(result.data?.settings.lazytracking).toEqual({ "Alpha:t1": false });
  });

  it("accepts null completion and energy", () => {
    const file = sampleExport();
    file["completion"] = null;
    file["energy"] = null;
    const result = validateExport(file);
    expect(result.ok).toBe(true);
    expect(result.counts.completion).toBe(0);
    expect(result.data?.completion).toBeNull();
  });
});

describe("parseExportFile", () => {
  it("rejects text that is not JSON", () => {
    const result = parseExportFile("not json");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("parses and validates a JSON export", () => {
    expect(parseExportFile(JSON.stringify(sampleExport())).ok).toBe(true);
  });
});

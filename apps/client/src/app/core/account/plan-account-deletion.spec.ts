import { ACCOUNT_COLLECTIONS, planAccountDeletion } from "./plan-account-deletion";

describe("planAccountDeletion", () => {
  it("deletes the five per-user documents and every owned task", () => {
    const batches = planAccountDeletion("me", ["t1", "t2"]);
    expect(batches).toEqual([[
      { collection: "tasks", id: "t1" },
      { collection: "tasks", id: "t2" },
      { collection: "roster", id: "me" },
      { collection: "settings", id: "me" },
      { collection: "completion", id: "me" },
      { collection: "energy", id: "me" },
      { collection: "users", id: "me" }
    ]]);
    expect(ACCOUNT_COLLECTIONS).toEqual(["roster", "settings", "completion", "energy", "users"]);
  });

  it("works with no tasks", () => {
    expect(planAccountDeletion("me", []).flat().length).toBe(5);
  });

  it("splits into batches within the limit, never an empty batch", () => {
    const batches = planAccountDeletion("me", ["t1", "t2", "t3", "t4"], 3);
    expect(batches.map(batch => batch.length)).toEqual([3, 3, 3]);
    expect(batches.flat().length).toBe(9);
  });
});

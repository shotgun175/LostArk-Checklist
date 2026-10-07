import { of } from "rxjs";
import { Firestore } from "@angular/fire/firestore";
import { AuthService } from "../database/services/auth.service";
import { CompletionService } from "../database/services/completion.service";
import { DataTransferService } from "./data-transfer.service";
import { LostarkExport } from "./lostark-export";

const commit = jest.fn();
const getDocMock = jest.fn();

jest.mock("@angular/fire/firestore", () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({ id: "fresh" })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(() => ({ set: jest.fn(), delete: jest.fn(), commit }))
}));

function file(): LostarkExport {
  return {
    format: 1,
    exportedAt: "",
    sourceUid: "src",
    roster: { characters: [], showAllTasks: false, trackedTasks: {} },
    settings: {},
    completion: { data: { t1: { amount: 1, updated: 1 } } },
    energy: null,
    tasks: [{ $key: "t1", label: "Chaos Dungeon" }] as LostarkExport["tasks"]
  };
}

describe("DataTransferService", () => {
  const previous = { $key: "me", data: { old: { amount: 1, updated: 1 } } };
  let setLocal: jest.Mock;
  let service: DataTransferService;

  beforeEach(() => {
    commit.mockReset();
    getDocMock.mockReset();
    setLocal = jest.fn();
    const completionService = { completion$: of(previous), setLocal } as unknown as CompletionService;
    const auth = { uid$: of("me") } as unknown as AuthService;
    service = new DataTransferService({} as Firestore, auth, completionService);
  });

  it("puts the previous in-memory completion back when the batch fails", async () => {
    commit.mockRejectedValue(new Error("permission-denied"));
    await expect(service.importExport(file())).rejects.toThrow("permission-denied");
    expect(setLocal).toHaveBeenCalledTimes(2);
    expect(setLocal.mock.calls[0][1]).toEqual({ $key: "me", data: { fresh: { amount: 1, updated: 1 } } });
    expect(setLocal.mock.calls[1]).toEqual(["me", previous]);
  });

  it("keeps the imported completion in memory when the batch succeeds", async () => {
    commit.mockResolvedValue(undefined);
    await service.importExport(file());
    expect(setLocal).toHaveBeenCalledTimes(1);
  });
});

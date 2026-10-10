import { TestBed } from "@angular/core/testing";
import { getDocFromServer } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "./firebase.providers";
import { SERVER_CHECK_TIMEOUT_MS, ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_firestore: unknown, name: string, id: string) => `${name}/${id}`),
  getDocFromServer: jest.fn()
}));

describe("ServerConnectionService", () => {
  let service: ServerConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE, useValue: {} },
        { provide: FIREBASE_AUTH, useValue: { currentUser: { uid: "me" } } }
      ]
    });
    service = TestBed.inject(ServerConnectionService);
  });

  afterEach(() => jest.useRealTimers());

  it("is reachable when the server returns the user's document", async () => {
    jest.mocked(getDocFromServer).mockResolvedValueOnce({} as never);
    await expect(service.isReachable()).resolves.toBe(true);
    expect(getDocFromServer).toHaveBeenCalledWith("users/me");
  });

  it("is reachable when the server answers with a refusal", async () => {
    jest.mocked(getDocFromServer).mockRejectedValueOnce({ code: "permission-denied" });
    await expect(service.isReachable()).resolves.toBe(true);
  });

  it("is offline when the read fails with unavailable, which it does at once offline", async () => {
    jest.mocked(getDocFromServer).mockRejectedValueOnce({ code: "unavailable" });
    await expect(service.isReachable()).resolves.toBe(false);
  });

  it("is offline when the server does not answer in time", async () => {
    jest.useFakeTimers();
    jest.mocked(getDocFromServer).mockReturnValueOnce(new Promise(() => undefined));
    const result = service.isReachable();
    jest.advanceTimersByTime(SERVER_CHECK_TIMEOUT_MS);
    await expect(result).resolves.toBe(false);
  });

  it("requireServer rejects offline with a message naming the action", async () => {
    jest.mocked(getDocFromServer).mockRejectedValueOnce({ code: "unavailable" });
    const refused = service.requireServer("download a backup");
    await expect(refused).rejects.toBeInstanceOf(ConnectionRequiredError);
    await expect(refused).rejects.toThrow("You're offline. Connect to the internet to download a backup.");
  });

  it("requireServer resolves online", async () => {
    jest.mocked(getDocFromServer).mockResolvedValueOnce({} as never);
    await expect(service.requireServer("log out")).resolves.toBeUndefined();
  });
});

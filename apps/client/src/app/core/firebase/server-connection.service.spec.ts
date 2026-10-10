import { TestBed } from "@angular/core/testing";
import { FIRESTORE_HOST_URL } from "./firebase.providers";
import { SERVER_CHECK_TIMEOUT_MS, ServerConnectionService } from "./server-connection.service";
import { ConnectionRequiredError } from "./connection-required";

jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({}));

describe("ServerConnectionService", () => {
  let service: ServerConnectionService;
  let fetchMock: jest.Mock;
  let onLine: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    onLine = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: FIRESTORE_HOST_URL, useValue: "https://firestore.example" }]
    });
    service = TestBed.inject(ServerConnectionService);
  });

  afterEach(() => {
    jest.useRealTimers();
    onLine.mockRestore();
  });

  it("is reachable when a real request to the Firestore host succeeds", async () => {
    fetchMock.mockResolvedValueOnce({});
    await expect(service.isReachable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://firestore.example/", { mode: "no-cors", cache: "no-store" });
  });

  it("is offline when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(service.isReachable()).resolves.toBe(false);
  });

  it("is offline without a request when the browser says it is offline", async () => {
    onLine.mockReturnValue(false);
    await expect(service.isReachable()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is offline when the host does not answer in time", async () => {
    jest.useFakeTimers();
    fetchMock.mockReturnValueOnce(new Promise(() => undefined));
    const result = service.isReachable();
    jest.advanceTimersByTime(SERVER_CHECK_TIMEOUT_MS);
    await expect(result).resolves.toBe(false);
  });

  it("requireServer rejects offline with a message naming the action", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const refused = service.requireServer("download a backup");
    await expect(refused).rejects.toBeInstanceOf(ConnectionRequiredError);
    await expect(refused).rejects.toThrow("You're offline. Connect to the internet to download a backup.");
  });

  it("requireServer resolves online", async () => {
    fetchMock.mockResolvedValueOnce({});
    await expect(service.requireServer("log out")).resolves.toBeUndefined();
  });
});

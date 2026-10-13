import { of, Subject } from "rxjs";
import { Firestore } from "firebase/firestore";
import { CompletionService } from "./completion.service";
import { AuthService } from "./auth.service";
import { Completion } from "../../../model/completion";

// No real Firebase in unit tests (same as roster.service.spec.ts)
jest.mock("firebase/app", () => ({}));
jest.mock("firebase/auth", () => ({}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => ({ withConverter: jest.fn(() => ({})) }))
}));

describe("CompletionService.waitsForServerCopy", () => {
  let snapshots: Subject<Completion>;
  let service: CompletionService;
  let shown: Completion | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    snapshots = new Subject<Completion>();
    service = new CompletionService({} as Firestore, { uid$: of("u1") } as unknown as AuthService);
    service.getOne = jest.fn(() => snapshots.asObservable());
    shown = undefined;
  });

  afterEach(() => jest.useRealTimers());

  function load(): void {
    service.completion$.subscribe(completion => shown = completion);
  }

  it("holds clicks on the cached copy while the server copy is expected", () => {
    load();
    snapshots.next({ $key: "u1", data: {}, fromCache: true });
    expect(service.waitsForServerCopy(shown as Completion)).toBe(true);
  });

  it("lets the server copy be changed at once", () => {
    load();
    snapshots.next({ $key: "u1", data: {}, fromCache: true });
    snapshots.next({ $key: "u1", data: {} });
    expect(service.waitsForServerCopy(shown as Completion)).toBe(false);
  });

  it("lets the cached copy be changed once the wait is over (offline)", () => {
    load();
    snapshots.next({ $key: "u1", data: {}, fromCache: true });
    jest.advanceTimersByTime(CompletionService.SERVER_COPY_WAIT_MS);
    expect(service.waitsForServerCopy(shown as Completion)).toBe(false);
  });

  it("counts the wait from when the ticks start loading, not from when the service was made", () => {
    jest.advanceTimersByTime(10 * CompletionService.SERVER_COPY_WAIT_MS);
    load();
    snapshots.next({ $key: "u1", data: {}, fromCache: true });
    expect(service.waitsForServerCopy(shown as Completion)).toBe(true);
  });

  it("lets a cached copy be changed after the server copy came (the connection dropped later)", () => {
    load();
    snapshots.next({ $key: "u1", data: {} });
    snapshots.next({ $key: "u1", data: {}, fromCache: true });
    expect(service.waitsForServerCopy(shown as Completion)).toBe(false);
  });
});

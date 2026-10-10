import { TestBed } from "@angular/core/testing";
import { ApplicationRef } from "@angular/core";
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from "@angular/service-worker";
import { BehaviorSubject, Subject } from "rxjs";
import { NzMessageService } from "ng-zorro-antd/message";
import { AppUpdateService, UNRECOVERABLE_RELOAD_DELAY_MS, UPDATE_CHECK_INTERVAL_MS } from "./app-update.service";
import { FirestoreStorage } from "../database/firestore-storage";

const calls: string[] = [];

jest.mock("../database/firestore-storage", () => ({
  FirestoreStorage: {
    flushPending: jest.fn(() => calls.push("flushPending"))
  }
}));

interface SwUpdateStub {
  isEnabled: boolean;
  versionUpdates: Subject<VersionEvent>;
  unrecoverable: Subject<UnrecoverableStateEvent>;
  checkForUpdate: jest.Mock;
  activateUpdate: jest.Mock;
}

function swUpdateStub(isEnabled = true): SwUpdateStub {
  return {
    isEnabled,
    versionUpdates: new Subject<VersionEvent>(),
    unrecoverable: new Subject<UnrecoverableStateEvent>(),
    checkForUpdate: jest.fn(() => Promise.resolve(false)),
    activateUpdate: jest.fn(() => { calls.push("activateUpdate"); return Promise.resolve(true); })
  };
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("AppUpdateService", () => {
  let sw: SwUpdateStub;
  let message: { error: jest.Mock };
  let stable: BehaviorSubject<boolean>;

  function create(enabled = true): AppUpdateService {
    sw = swUpdateStub(enabled);
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: NzMessageService, useValue: message }
      ]
    });
    // The real ApplicationRef stays; only its stability stream is under the test's control.
    Object.defineProperty(TestBed.inject(ApplicationRef), "isStable", { configurable: true, value: stable });
    const service = TestBed.inject(AppUpdateService);
    jest.spyOn(service, "reloadPage").mockImplementation(() => calls.push("reload"));
    return service;
  }

  beforeEach(() => {
    calls.length = 0;
    jest.mocked(FirestoreStorage.flushPending).mockClear();
    message = { error: jest.fn() };
    stable = new BehaviorSubject(false);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("shows the update banner once a new version is ready", () => {
    const service = create();
    expect(service.updateReady()).toBe(false);
    sw.versionUpdates.next({ type: "VERSION_DETECTED", version: { hash: "b" } });
    expect(service.updateReady()).toBe(false);
    sw.versionUpdates.next({ type: "VERSION_READY", currentVersion: { hash: "a" }, latestVersion: { hash: "b" } });
    expect(service.updateReady()).toBe(true);
  });

  it("reload sends queued ticks, then switches version, then reloads", async () => {
    const service = create();
    await service.reload();
    expect(calls).toEqual(["flushPending", "activateUpdate", "reload"]);
  });

  it("reload still reloads when switching version fails", async () => {
    const service = create();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    sw.activateUpdate.mockRejectedValueOnce(new Error("no update"));
    await service.reload();
    expect(calls).toEqual(["flushPending", "reload"]);
  });

  it("an unrecoverable state shows a message, then reloads after a short wait", () => {
    jest.useFakeTimers();
    create();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    sw.unrecoverable.next({ type: "UNRECOVERABLE_STATE", reason: "missing chunk" });
    expect(message.error).toHaveBeenCalledWith("This page is out of date and will reload.", { nzDuration: UNRECOVERABLE_RELOAD_DELAY_MS });
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(UNRECOVERABLE_RELOAD_DELAY_MS);
    expect(calls).toEqual(["flushPending", "reload"]);
  });

  it("checks for a new version when the tab becomes visible, not when it is hidden", () => {
    create();
    setVisibility("hidden");
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it("a failed check (offline) is caught and logged", async () => {
    create();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    sw.checkForUpdate.mockRejectedValueOnce(new Error("offline"));
    setVisibility("visible");
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith("Could not check for a new version:", expect.any(Error));
  });

  it("checks every six hours, starting only once the app is stable", () => {
    jest.useFakeTimers();
    create();
    jest.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    stable.next(true);
    jest.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it("stops checking when destroyed", () => {
    jest.useFakeTimers();
    create();
    stable.next(true);
    TestBed.resetTestingModule();
    setVisibility("visible");
    jest.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });

  it("does nothing while the service worker is off", () => {
    jest.useFakeTimers();
    const service = create(false);
    stable.next(true);
    sw.versionUpdates.next({ type: "VERSION_READY", currentVersion: { hash: "a" }, latestVersion: { hash: "b" } });
    sw.unrecoverable.next({ type: "UNRECOVERABLE_STATE", reason: "missing chunk" });
    setVisibility("visible");
    jest.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS + UNRECOVERABLE_RELOAD_DELAY_MS);
    expect(service.updateReady()).toBe(false);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});

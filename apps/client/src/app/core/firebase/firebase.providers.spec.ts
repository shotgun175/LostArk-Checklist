import { NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FIREBASE_APP, FIREBASE_AUTH, FIRESTORE, provideFirebase } from "./firebase.providers";

const mockApp = { name: "[DEFAULT]" };
const mockAuth = { kind: "auth" };
const mockFirestore = { kind: "firestore" };
const mockInitializeApp = jest.fn();
const mockGetAuth = jest.fn();
const mockUseDeviceLanguage = jest.fn();
const mockConnectAuthEmulator = jest.fn();
const mockGetFirestore = jest.fn();
const mockConnectFirestoreEmulator = jest.fn();

// Factories only: the real Node build of firebase/auth 10 cannot load on Node 16.
jest.mock("firebase/app", () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args)
}));
jest.mock("firebase/auth", () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  useDeviceLanguage: (...args: unknown[]) => mockUseDeviceLanguage(...args),
  connectAuthEmulator: (...args: unknown[]) => mockConnectAuthEmulator(...args)
}));
jest.mock("firebase/firestore", () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  connectFirestoreEmulator: (...args: unknown[]) => mockConnectFirestoreEmulator(...args)
}));

const options = { projectId: "demo-test", apiKey: "key", appId: "app" };

describe("provideFirebase", () => {
  beforeEach(() => {
    mockInitializeApp.mockReset().mockReturnValue(mockApp);
    mockGetAuth.mockReset().mockReturnValue(mockAuth);
    mockGetFirestore.mockReset().mockReturnValue(mockFirestore);
    mockUseDeviceLanguage.mockReset();
    mockConnectAuthEmulator.mockReset();
    mockConnectFirestoreEmulator.mockReset();
  });

  it("creates Auth and Firestore from one app, with the device language and no emulators", () => {
    TestBed.configureTestingModule({ providers: provideFirebase({ firebase: options, useEmulators: false }) });
    expect(TestBed.inject(FIREBASE_AUTH)).toBe(mockAuth);
    expect(TestBed.inject(FIRESTORE)).toBe(mockFirestore);
    expect(TestBed.inject(FIREBASE_APP)).toBe(mockApp);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).toHaveBeenCalledWith(options);
    expect(mockGetAuth).toHaveBeenCalledWith(mockApp);
    expect(mockUseDeviceLanguage).toHaveBeenCalledWith(mockAuth);
    expect(mockGetFirestore).toHaveBeenCalledWith(mockApp);
    expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("connects both emulators on the firebase.json ports when useEmulators is on", () => {
    TestBed.configureTestingModule({ providers: provideFirebase({ firebase: options, useEmulators: true }) });
    TestBed.inject(FIREBASE_AUTH);
    TestBed.inject(FIRESTORE);
    expect(mockConnectAuthEmulator).toHaveBeenCalledWith(mockAuth, "http://localhost:9099");
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(mockFirestore, "localhost", 8085);
  });

  it("creates the app, Auth and Firestore outside the Angular zone, as AngularFire did", () => {
    const inAngularZone: boolean[] = [];
    const record = (result: unknown) => () => {
      inAngularZone.push(NgZone.isInAngularZone());
      return result;
    };
    mockInitializeApp.mockImplementation(record(mockApp));
    mockGetAuth.mockImplementation(record(mockAuth));
    mockGetFirestore.mockImplementation(record(mockFirestore));
    TestBed.configureTestingModule({ providers: provideFirebase({ firebase: options, useEmulators: false }) });
    TestBed.inject(NgZone).run(() => {
      TestBed.inject(FIREBASE_AUTH);
      TestBed.inject(FIRESTORE);
    });
    expect(inAngularZone).toEqual([false, false, false]);
  });
});

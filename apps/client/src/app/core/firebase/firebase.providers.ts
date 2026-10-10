import { InjectionToken, NgZone, Provider } from "@angular/core";
import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth, useDeviceLanguage } from "firebase/auth";
import { connectFirestoreEmulator, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { AppCheckEnvironment, initAppCheck } from "./app-check";

export interface FirebaseEnvironment extends AppCheckEnvironment {
  firebase: FirebaseOptions;
}

export const FIREBASE_APP = new InjectionToken<FirebaseApp>("FIREBASE_APP");
export const FIREBASE_AUTH = new InjectionToken<Auth>("FIREBASE_AUTH");
export const FIRESTORE = new InjectionToken<Firestore>("FIRESTORE");

/**
 * The Firebase app, Auth and Firestore for the app module. Emulator ports match firebase.json.
 * They are created outside the Angular zone, as AngularFire did, so Firebase's own timers (such as
 * Auth's IndexedDB polling) do not run change detection.
 */
export function provideFirebase(environment: FirebaseEnvironment): Provider[] {
  return [
    {
      provide: FIREBASE_APP,
      deps: [NgZone],
      useFactory: (zone: NgZone): FirebaseApp => zone.runOutsideAngular(() => {
        const app = initializeApp(environment.firebase);
        // Before Auth and Firestore: their factories inject FIREBASE_APP, so this always runs first.
        initAppCheck(app, environment);
        return app;
      })
    },
    {
      provide: FIREBASE_AUTH,
      deps: [FIREBASE_APP, NgZone],
      useFactory: (app: FirebaseApp, zone: NgZone): Auth => zone.runOutsideAngular(() => {
        const auth = getAuth(app);
        useDeviceLanguage(auth);
        if (environment.useEmulators) {
          connectAuthEmulator(auth, "http://localhost:9099");
        }
        return auth;
      })
    },
    {
      provide: FIRESTORE,
      deps: [FIREBASE_APP, NgZone],
      useFactory: (app: FirebaseApp, zone: NgZone): Firestore => zone.runOutsideAngular(() => {
        // Data is kept in IndexedDB, shared by all open tabs, so the checklist opens and saves
        // offline; queued changes are sent when the device is back online. Without IndexedDB the
        // SDK falls back to a memory cache by itself.
        const firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
        if (environment.useEmulators) {
          connectFirestoreEmulator(firestore, "localhost", 8085);
        }
        return firestore;
      })
    }
  ];
}

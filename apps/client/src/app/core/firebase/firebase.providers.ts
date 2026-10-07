import { InjectionToken, Provider } from "@angular/core";
import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth, useDeviceLanguage } from "firebase/auth";
import { connectFirestoreEmulator, Firestore, getFirestore } from "firebase/firestore";

export interface FirebaseEnvironment {
  firebase: FirebaseOptions;
  useEmulators: boolean;
}

export const FIREBASE_APP = new InjectionToken<FirebaseApp>("FIREBASE_APP");
export const FIREBASE_AUTH = new InjectionToken<Auth>("FIREBASE_AUTH");
export const FIRESTORE = new InjectionToken<Firestore>("FIRESTORE");

/** The Firebase app, Auth and Firestore for the app module. Emulator ports match firebase.json. */
export function provideFirebase(environment: FirebaseEnvironment): Provider[] {
  return [
    {
      provide: FIREBASE_APP,
      useFactory: (): FirebaseApp => initializeApp(environment.firebase)
    },
    {
      provide: FIREBASE_AUTH,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp): Auth => {
        const auth = getAuth(app);
        useDeviceLanguage(auth);
        if (environment.useEmulators) {
          connectAuthEmulator(auth, "http://localhost:9099");
        }
        return auth;
      }
    },
    {
      provide: FIRESTORE,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp): Firestore => {
        const firestore = getFirestore(app);
        if (environment.useEmulators) {
          connectFirestoreEmulator(firestore, "localhost", 8085);
        }
        return firestore;
      }
    }
  ];
}

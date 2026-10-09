// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  verboseOperations: false,
  useEmulators: false,
  recaptchaEnterpriseKey: '6Lf1N-UtAAAAAMw5kjJJ3KAscnDlkxUycxCi5-Fg',
  appCheckDebug: true,
  // One-click import (Settings, Bring data over): null means this page's own origin.
  importBridge: {
    appOrigin: null as string | null,
    sourceOrigins: ['https://lostark-helper.com']
  },
  firebase: {
    projectId: 'loa-checklist',
    appId: '1:840196169331:web:fa4f4dc69b8cd95d5f9406',
    storageBucket: 'loa-checklist.firebasestorage.app',
    apiKey: 'AIzaSyA7C1ZNoySzCBu6OrjoWV2cp0X7Ru8x4QE',
    authDomain: 'loa-checklist.firebaseapp.com',
    messagingSenderId: '840196169331',
  },
  production: false
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

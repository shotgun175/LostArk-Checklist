export const environment = {
  verboseOperations: false,
  useEmulators: false,
  recaptchaEnterpriseKey: '6Lf1N-UtAAAAAMw5kjJJ3KAscnDlkxUycxCi5-Fg',
  appCheckDebug: false,
  // One-click import (Settings, Bring data over): the bookmark opens this origin and accepts data only from these.
  importBridge: {
    appOrigin: 'https://loa-checklist.web.app',
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
  production: true
};

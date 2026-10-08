// Local Firebase emulators (npx nx serve client --configuration=emulator).
// A demo- project id needs no login and can never reach a real Firebase project.
export const environment = {
  verboseOperations: false,
  useEmulators: true,
  recaptchaEnterpriseKey: '',
  appCheckDebug: false,
  firebase: {
    projectId: 'demo-loa-checklist',
    appId: '1:000000000000:web:0000000000000000000000',
    storageBucket: 'demo-loa-checklist.appspot.com',
    apiKey: 'demo-api-key',
    authDomain: 'demo-loa-checklist.firebaseapp.com',
    messagingSenderId: '000000000000',
  },
  production: false
};

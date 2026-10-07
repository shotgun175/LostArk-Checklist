# Lost Ark Helper

* [Korean (한국어)](README_ko.md)

A set of tools to help you organizing your Lost Ark adventure

[https://lostark-helper.com](https://lostark-helper.com)

![](https://user-images.githubusercontent.com/11519203/167081443-faaba8b0-2c55-449c-9cf3-650c436479cf.png)

## Checklist

The checklist page provides you with tasks checkboxes, so you can mark what's done and have it reset automatically for you every day/week.

All you have to do is configure your roster, manage the tasks you want to track, and you're good to go !


## Contributing

This project is open to Pull Requests, feel free to join the [Discord Server](https://discord.gg/ZyYSJChpX9) if you need help to contribute to this.

The tech stack is pretty simple:

 - Angular w/ Ant Design
 - Firebase hosting

To start the project locally:

 - npm install
 - npm start

## Signing in and syncing

- Without signing in, each browser gets its own anonymous account. Your data is saved, but only in that browser profile. Clearing site data loses it.
- To use the same data on your phone (or on a second PC):
  1. On the PC that already has your data, open the user menu and choose **Register**. Create an account with email and password. Registering upgrades the anonymous account in place: same account, same data.
  2. On the phone, open the user menu, choose **Sign in** and use the same email and password.
- **Trap: Sign in is not Register.** On a browser that already has anonymous data, **Sign in** switches to the other account and leaves the anonymous data behind, so it no longer shows. Use **Register** the first time on the browser that holds your data. This behavior comes from the original app and is kept as is. The original code also tries to delete the previous anonymous account's tasks during that switch. On this site the database rules block that, so nothing is deleted and the app ignores the refusal.
- **Log out** starts a fresh, empty anonymous account in that browser. Your registered account's data is untouched. Sign in again to get it back.

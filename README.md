# Lost Ark Helper

* [Korean (한국어)](README_ko.md)

A set of tools to help you organizing your Lost Ark adventure

[https://lostark-helper.com](https://lostark-helper.com)

![](https://user-images.githubusercontent.com/11519203/167081443-faaba8b0-2c55-449c-9cf3-650c436479cf.png)

## Checklist

The checklist page provides you with tasks checkboxes, so you can mark what's done and have it reset automatically for you every day/week.

All you have to do is configure your roster, manage the tasks you want to track, and you're good to go !

### Which raids are tracked

- Each character tracks the 3 newest raids it can enter (by item level) by default. Older raids are not tracked for that character. Every task that is not a raid stays tracked by default.
- The default follows the character's item level, so it moves to newer raids as the character levels up.
- **Settings, Task tracking** shows every character with a small switch per task: faded switches follow the default, solid ones are your own choice, which always wins over the default, and a dash means the character's item level does not fit that task. The grid scrolls sideways with the Task column pinned.
- Click **reset** under a cell to send it back to automatic, **reset** under a character's name to do that for all of its cells, or **Reset all to auto** (it asks first) to clear every choice. The card header counts how many choices you have set.

### Gold Planner running mode

- The first time you tick **Taking Gold** on a raid or a gate that has no running mode yet, the Gold Planner picks the highest mode the character's item level allows: Nightmare, then Hard, then Normal. It never picks Solo.
- A mode that is already set (Solo included) is never changed, and unticking then ticking again keeps it.
- A character earns gold from at most 3 raids a week: once 3 raids have **Taking Gold** ticked, it is disabled on that character's other raids (running mode and **Taking Chest** stay usable) until you untick one, and a character already over 3 shows a warning in its column header.
- The totals row shows each character's gold and the grand total as two numbers, tradable and bound. Taking Chest costs come out of bound gold, and Chaos Dungeons and Other sources count as tradable.

### Heads-up for existing users

- Cells for raids older than a character's 3 newest now disappear from the checklist and the Gold Planner, unless you switched them on yourself in Settings, Task tracking.
- Gold ticked on such an older raid no longer counts in the weekly totals. To keep it, open Settings, Task tracking and switch that cell on.
- Cells you already switched on or off keep your choice.


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

## Bringing data over from lostark-helper.com

1. In Chrome, in the same browser profile where you use lostark-helper.com, open https://lostark-helper.com/checklist (signed in as you, if you use an account there) and wait for the checklist to load. Opening the checklist first also brings the rest bonus up to date.
2. Press F12, open the Console tab, paste the whole content of `tools/export-from-lostark-helper.js` and press Enter. If Chrome shows a warning about pasting instead of running it, type `allow pasting`, press Enter, then paste again and press Enter. Chrome downloads `lostark-helper-export-<date>.json`, and the console shows `Export done: N characters, N tasks, N completion entries`.
3. On this site, open **Settings**, **Bring data over**, **Import from Lostark-helper**, and pick the file. Check the counts, then click **Import this file** and confirm. The page reloads when the import is done.

The import replaces this account's roster, tasks, ticks, rest bonus and settings. Tasks get new ids in this account and ticks, tracking and lazy flags are moved to them, so the same file can be imported into more than one account. The snippet reads only your own documents with your own sign-in. Export right before you import, so the rest bonus and ticks are current.

## Backups

- **Download backup** (Settings, Bring data over) saves this account's data as a JSON file.
- **Restore backup** imports such a file. It uses the same format as the lostark-helper.com export and replaces the same data.

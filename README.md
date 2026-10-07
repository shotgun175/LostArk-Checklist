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
- **Settings, Task tracking** shows every character with a small switch per task, in two sections: **Raids** first, then **Other tasks** (every other character task, your own Tasks Manager tasks included). Tasks switched off in Tasks Manager are not listed. Faded switches follow the default, solid ones are your own choice, which always wins over the default, and a dash means the character's item level does not fit that task. The grid scrolls sideways with the Task column pinned.
- Click **reset** under a cell to send it back to automatic, **reset** under a character's name to do that for all of its cells, or **Reset all to auto** (it asks first) to clear every choice. The card header counts how many choices you have set, including choices for tasks switched off in Tasks Manager, which the resets clear too.
- Raids that none of your visible characters tracks by default and that you have not switched on for any of them sit in a collapsed **Older raids** group right under the other raids. A choice saved for a character whose item level no longer fits the raid does not keep it out of that group. Click the group to open or close it; the browser remembers which. A raid moves in and out of the group by itself as item levels change.
- The **&#8942;** button next to every task name opens **Track for all**, **Ignore for all** and **Back to auto for all**. Each one changes that task for every character whose item level fits it, in one step, and counts as your own choice like a single switch.

### Gold Planner

- The page lists your characters on the left: a **Roster this week** total (tradable, bound and how many gold earners), then **Gold earners** (characters with Weekly Gold) with their gold raids and totals, then **Other characters** with their box costs. Hidden characters follow **Show your hidden characters**.
- Click a character to plan its raids in the panel on the right. The browser remembers the last character you picked. On narrow screens the list sits above the panel.
- A character without Weekly Gold can still pick a difficulty and tick **Taking Chest** (ticking a chest on a gate with no difficulty picks the highest one it can run), but **Taking Gold** is disabled; its box costs count against that character's own total and the roster total.
- The first time you tick **Taking Gold** on a raid or a gate that has no running mode yet, the Gold Planner picks the highest mode the character's item level allows: Nightmare, then Hard, then Normal. It never picks Solo.
- A mode that is already set (Solo included) is never changed, and unticking then ticking again keeps it.
- A character earns gold from at most 3 raids a week: once 3 raids have **Taking Gold** ticked, it is disabled on that character's other raids (running mode and **Taking Chest** stay usable) until you untick one. If a character ever has more than 3 (for example from imported data), the Gold Planner keeps the 3 raids that pay the most gold for the selected modes (on a tie, the newer raid), unticks **Taking Gold** on the others, saves that and shows a short message such as "Valtist: gold limit is 3 raids, unticked Echidna". Totals and the checklist gold coin never count more than 3 raids per character.
- Each character's total and the roster total show two numbers, tradable and bound. Taking Chest costs come out of bound gold (a character's bound can go below zero; in the roster total, bound below zero is taken from tradable instead), and Chaos Dungeons and Other sources count as tradable.

### Roster

- At most 6 characters can have **Weekly Gold**, as in the game. Once 6 have it, the box is disabled on the others until you untick one.
- A new character gets Weekly Gold only while fewer than 6 characters have it.
- A roster that already has more than 6 (for example from an import) shows a warning on the Roster page; nothing is unticked for you.

### Heads-up for existing users

- Cells for raids older than a character's 3 newest now disappear from the checklist and the Gold Planner, unless you switched them on yourself in Settings, Task tracking.
- Gold ticked on such an older raid no longer counts in the weekly totals. To keep it, open Settings, Task tracking and switch that cell on.
- Cells you already switched on or off keep your choice.
- If 6 or fewer characters have Weekly Gold and every character has it, the Gold Planner totals and the Roster page work as before.
- Characters without Weekly Gold now appear in the Gold Planner. Their box costs and their Chaos Dungeons and Other sources entries now count in the roster total.
- On the checklist, a raid of a character without Weekly Gold now shows its mode in the corner badge (no gold coin).
- A character saved without a Weekly Gold setting now gets it only while fewer than 6 characters have it, not by its place in the roster. A roster with more than 6 shows a warning on the Roster page; nothing is unticked.
- A character with **Taking Gold** on more than 3 raids gets the lowest-paying extras unticked the next time you open the Gold Planner, with a message naming them. Characters with 3 or fewer are not touched.
- **Kalthertz Slaves** and **Una's Task** are no longer added for new accounts. If you have them, they stay; switch them off in Tasks Manager to hide them everywhere, Task tracking included.
- **Howl's Hourglass** is now spelled **Haal's Hourglass**. Your existing task is renamed in place, so its checkmarks and tracking choices carry over and no duplicate appears.


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

The import replaces this account's roster, tasks, ticks, rest bonus and settings. Tasks get new ids in this account and ticks, tracking and lazy flags are moved to them, so the same file can be imported into more than one account. Raid tracking choices from lostark-helper.com are not brought over, so every character starts on its 3 newest raids; daily and weekly choices are kept. Choices for tasks that are not in the file are dropped. The snippet reads only your own documents with your own sign-in. Export right before you import, so the rest bonus and ticks are current.

## Backups

- **Download backup** (Settings, Bring data over) saves this account's data as a JSON file.
- **Restore backup** imports such a file. It uses the same format as the lostark-helper.com export and replaces the same data. Unlike **Import from Lostark-helper**, it keeps your raid tracking choices.

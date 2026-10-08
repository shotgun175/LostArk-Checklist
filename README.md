# Lost Ark Checklist

A daily and weekly checklist and gold planner for Lost Ark (Global version) rosters: https://loa-checklist.web.app

Fan-made tool, not affiliated with or endorsed by Smilegate or Amazon Games. Lost Ark names and icons belong to their owners. Based on [Lostark-helper](https://github.com/Supamiu/Lostark-helper) by Supamiu.

## Pages

- **Checklist**: daily and weekly tasks per character, with rest bonus.
- **Gold Planner**: weekly gold per character and raid.
- **Roster** and **Tasks Manager**: your characters and the tasks you track. In Tasks Manager, drag a task by the grip at the left of its row to change the order.
- **Settings**: display options, lazy tasks, rest bonus, task tracking, backups and account deletion.
- **Privacy** (footer link): what is stored and why.

## Checklist

Tick off what you have done; ticks clear by themselves at the daily and weekly reset. Set up your characters on **Roster** and the tasks you want on **Tasks Manager** first.

### Which raids are tracked

- Each character tracks the 3 newest raids it can enter (by item level) by default. Older raids are not tracked for that character. Every task that is not a raid stays tracked by default, except **Kalthertz Slaves** and **Una's Task**, which are off by default.
- The default follows the character's item level, so it moves to newer raids as the character levels up.
- **Settings, Task tracking** shows every character with a small switch per task, in two sections: **Raids** first, then **Other tasks** (every other character task, your own Tasks Manager tasks included). Tasks switched off in Tasks Manager are not listed. Faded switches follow the default, solid ones are your own choice, which always wins over the default, and a dash means the character's item level does not fit that task. The grid scrolls sideways with the Task column pinned.
- Click **reset** under a cell to send it back to automatic, **reset** under a character's name to do that for all of its cells, or **Reset all to auto** (it asks first) to clear every choice. The card header counts how many choices you have set, including choices for tasks switched off in Tasks Manager, which the resets clear too.
- Raids that none of your visible characters tracks by default and that you have not switched on for any of them sit in a collapsed **Older raids** group right under the other raids. A choice saved for a character whose item level no longer fits the raid does not keep it out of that group. Click the group to open or close it; the browser remembers which. A raid moves in and out of the group by itself as item levels change.
- The **&#8942;** button next to every task name opens **Track for all**, **Ignore for all** and **Back to auto for all**. Each one changes that task for every character whose item level fits it, in one step, and counts as your own choice like a single switch.

### Gold Planner

- A card at the top shows the roster's **net gold this week**: the gold earned so far, after the chests paid so far, out of what is **possible** (the gold of every planned gold raid of the gold earners, before chests), and the **% earned**. "Earned so far" comes from the raids ticked done on the Checklist. A bar splits the possible gold into earned tradable, earned bound, chests paid and not earned yet. Under it, one line gives the roster's tradable and bound after chests for what the **Full Planning** switch shows, and how many gold earners there are.
- The page lists your characters on the left: **Gold earners** (characters with Weekly Gold), each with its gold raids, net earned out of possible, the tradable / bound / chests split and a small bar ("No gold raids planned" when there is nothing), then **Other characters** with their box costs. Hidden characters follow **Show your hidden characters**.
- Click a character to plan its raids in the panel on the right. The browser remembers the last character you picked. On narrow screens the list sits above the panel.
- For a gold earner, the panel starts with the same summary for that character, plus where its chests are paid from (for example "Chests 48,640: 48,640 from bound, 0 from tradable"). Each raid, and each gate when expanded, says **done**, **to do** or how many gates are done, from the Checklist.
- A character without Weekly Gold can still pick a difficulty and tick **Taking Chest** (ticking a chest on a gate with no difficulty picks the highest one it can run), but **Taking Gold** is disabled; its box costs count against that character's own total and the roster total.
- The first time you tick **Taking Gold** on a raid or a gate that has no running mode yet, the Gold Planner picks the highest mode the character's item level allows: Nightmare, then Hard, then Normal. It never picks Solo.
- A mode that is already set (Solo included) is never changed, and unticking then ticking again keeps it.
- A character earns gold from at most 3 raids a week: once 3 raids have **Taking Gold** ticked, it is disabled on that character's other raids (running mode and **Taking Chest** stay usable) until you untick one. If a character ever has more than 3 (for example from imported data), the Gold Planner keeps the 3 raids that pay the most gold for the selected modes (on a tie, the newer raid), unticks **Taking Gold** on the others, saves that and shows a short message such as "Valtist: gold limit is 3 raids, unticked Echidna". Totals and the checklist gold coin never count more than 3 raids per character.
- Each character's total and the roster total show two numbers, tradable and bound. Taking Chest costs are paid from that character's own bound gold first, then from its tradable gold, so bound never goes below zero. The roster adds up each character's numbers after chests.
- Chaos Dungeons and Other sources count as tradable gold earned this week; an amount above zero also adds to possible. A negative Other entry (a bus cost) only lowers what is earned.
- The **Full Planning** / **Remaining for the week** switch changes the raids listed and the totals; the summary cards always show earned so far out of possible for the whole week.

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
- **Kalthertz Slaves** and **Una's Task** are still tasks (new accounts get them too, and an account missing one gets it back), but they are off by default for every character, so they no longer show on the checklist. To track one, switch it on per character in Settings, Task tracking (or use the **&#8942;** menu on its row for every character). Cells you already switched on or off keep your choice.
- **Howl's Hourglass** is now spelled **Haal's Hourglass**. Your existing task is renamed in place, so its checkmarks and tracking choices carry over and no duplicate appears.
- **Weekly Mission** is gone. It no longer exists in the game, so it is removed from the built-in list and from existing accounts the next time the site loads.

## Signing in and syncing

- Without signing in, each browser gets its own anonymous account. Your data is saved, but only in that browser profile. Clearing site data loses it.
- To use the same data on your phone (or on a second PC):
  1. On the PC that already has your data, open the user menu and choose **Register**. Create an account with email and password. Registering upgrades the anonymous account in place: same account, same data.
  2. On the phone, open the user menu, choose **Sign in** and use the same email and password.
- **Trap: Sign in is not Register.** On a browser that already has anonymous data, **Sign in** switches to the other account and leaves the anonymous data behind, so it no longer shows. Use **Register** the first time on the browser that holds your data. This behavior comes from the original app and is kept as is. The original code also tries to delete the previous anonymous account's tasks during that switch. On this site the database rules block that, so nothing is deleted and the app ignores the refusal.
- **Log out** starts a fresh, empty anonymous account in that browser. Your registered account's data is untouched. Sign in again to get it back.
- **Delete my account and data** (Settings) deletes everything stored for your account and then the account. Registered users confirm with their password. For a guest it deletes the data and starts a new guest account.

## Bringing data over from lostark-helper.com

1. In Chrome, in the same browser profile where you use lostark-helper.com, open https://lostark-helper.com/checklist (signed in as you, if you use an account there) and wait for the checklist to load. Opening the checklist first also brings the rest bonus up to date.
2. Press F12, open the Console tab, paste the whole content of `tools/export-from-lostark-helper.js` and press Enter. If Chrome shows a warning about pasting instead of running it, type `allow pasting`, press Enter, then paste again and press Enter. Chrome downloads `lostark-helper-export-<date>.json`, and the console shows `Export done: N characters, N tasks, N completion entries`.
3. On this site, open **Settings**, **Bring data over**, **Import from Lostark-helper**, and pick the file. Check the counts, then click **Import this file** and confirm. The page reloads when the import is done.

The import replaces this account's roster, tasks, ticks, rest bonus and settings. Tasks get new ids in this account and ticks, tracking and lazy flags are moved to them, so the same file can be imported into more than one account. Raid tracking choices from lostark-helper.com are not brought over, so every character starts on its 3 newest raids; daily and weekly choices are kept. Choices for tasks that are not in the file are dropped. The snippet reads only your own documents with your own sign-in. Export right before you import, so the rest bonus and ticks are current.

## Backups

- **Download backup** (Settings, Bring data over) saves this account's data as a JSON file.
- **Restore backup** imports such a file. It uses the same format as the lostark-helper.com export and replaces the same data. Unlike **Import from Lostark-helper**, it keeps your raid tracking choices.

## Development

Stack: Angular 22 with NgModules, ng-zorro-antd 22, Nx 23, Firebase JS SDK 12 (used directly through `apps/client/src/app/core/firebase`, no AngularFire), Jest.

Requirements:

- Node 24.21.0 and the npm that comes with it. The version is pinned in `package.json`; with [Volta](https://volta.sh) installed it is picked automatically.
- Java 21 or newer, only for the local emulators.
- The Firebase CLI is not a project dependency. The commands below run it with `npx -y firebase-tools`, which downloads it on first use.

```bash
npm ci                                           # install the exact versions from package-lock.json
npx nx serve client --configuration=emulator     # http://localhost:4200 against the local emulators, test data only
npx nx serve client                              # http://localhost:4200 against the live Firebase project
npx nx build client                              # production build into dist/apps/client/browser
npx nx lint client
```

Unit tests, exactly as CI runs them:

```bash
npx nx test client
```

### Local emulators

Point `JAVA_HOME` at your Java install and put its `bin` folder on `PATH`, then start Auth and Firestore (Git Bash, macOS or Linux shell; the path is an example):

```bash
export JAVA_HOME="/c/path/to/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
npx -y firebase-tools emulators:start --only auth,firestore --project demo-loa-checklist
```

Auth runs on port 9099 and Firestore on 8085 (see `firebase.json`). In a second terminal run `npx nx serve client --configuration=emulator`. That configuration uses the project id `demo-loa-checklist`, which can never reach a real project, and App Check is off there. The emulators start empty every time.

For test data, open http://localhost:4200/settings, choose **Bring data over**, **Import from Lostark-helper** and pick `tools/fixtures/lostark-helper-export-synthetic.json` (15 made-up characters, 6 of them visible). Never use a real export for local testing.

To check the database rules against the running emulators:

```bash
node tools/verify-firestore-rules.mjs --emulator
```

### App Check on localhost

The live site uses App Check with reCAPTCHA Enterprise. Today it only monitors requests; it is not enforced, so `npx nx serve client` works without extra steps.

Once App Check is enforced, `npx nx serve client` needs a debug token, because it talks to the live project from localhost:

1. Open http://localhost:4200 and copy the `App Check debug token` line from the browser console.
2. In the Firebase console, open App Check, Apps, the web app's menu, **Manage debug tokens**, and add it.

The token stays in your browser. Never commit it, paste it into code or share it. Production builds never use debug mode, and the emulator configuration does not use App Check at all.

## Deploy

Deploying needs a Google account with access to the `loa-checklist` Firebase project. Sign in once with `npx -y firebase-tools login`, then:

```bash
npx nx build client
npx -y firebase-tools deploy --only hosting,firestore:rules --project loa-checklist
node tools/verify-firestore-rules.mjs
```

The build lands in `dist/apps/client/browser`, which `firebase.json` serves. The last command checks the deployed database rules: it creates two throwaway guest accounts in the live project, tries allowed and forbidden reads and writes, then deletes everything it created and both accounts. Pushes to master only run CI (build and unit tests); deploys are always manual.

## Firebase plan

The project stays on the free Spark plan. On Spark, a product that goes over its quota stops working until the quota resets; it never bills. The limits that matter here:

- **Firestore**: 1 GiB stored, 50,000 document reads, 20,000 writes and 20,000 deletes a day, 10 GiB a month of downloads.
- **Hosting**: 10 GB stored, 360 MB of downloads a day.
- **Authentication**: email and password plus guest (anonymous) sign-in, free up to 50,000 monthly active users.
- **App Check**: reCAPTCHA Enterprise includes 10,000 free assessments a month. The 7 day App Check token lifetime keeps usage far below that.

The app saves ticks and toggles as small field updates grouped about once a second per document, which keeps writes well inside the daily quota.

If the project ever moves to the Blaze plan (for example for Cloud Functions), first create a budget alert in Google Cloud console, Billing, Budgets and alerts, with a small amount and alerts at 50, 90 and 100 percent. Budget alerts warn; they do not cap spending.

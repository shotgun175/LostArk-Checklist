# Lost Ark Checklist

A daily and weekly checklist and gold planner for Lost Ark (Global version) rosters: https://loa-checklist.web.app

Fan-made tool, not affiliated with or endorsed by Smilegate or Amazon Games. Lost Ark names and icons belong to their owners. Based on [Lostark-helper](https://github.com/Supamiu/Lostark-helper) by Supamiu.

## Pages

- **Checklist**: daily and weekly tasks per character, with rest bonus.
- **Gold Planner**: weekly gold per character and raid.
- **Roster** and **Tasks Manager**: your characters and the tasks you track. On both pages, drag a row by the grip at the left of it to change the order, or focus the grip (Tab) and press Arrow Up or Arrow Down. The rest of the row works like a normal form, so text in its inputs can be selected.
- **Settings**: display options, lazy tasks, rest bonus, task tracking, backups and account deletion. Rest bonus lists only the characters shown on the Checklist; tick **Show hidden characters** to also edit the ones marked Hide on the Roster page. A cleared rest bonus cell saves 0, and values are rounded to the nearest 10.
- On a phone (under 768 px wide) the sidebar is hidden; the menu button at the top left opens it over the page, and a tap on a page or outside it closes it. The menu fits the visible screen above the browser's toolbars; if the screen is short, the page links scroll and the bottom links stay in view. Wide tables (the Checklist grid, Tasks Manager, Settings) scroll sideways inside their own box, so the page itself always fits the phone's width. On a phone or tablet (touch screen) the Checklist and Tasks Manager tables have no up-and-down scroll box of their own: the whole page scrolls, and the table's header row stays at the top of the screen (not on a phone turned sideways, where it would cover too much). On a PC they keep their own scroll box. From 768 px up, the sidebar's collapse button (also reachable with Tab) remembers your choice.
- **Lost Ark Tools** (at the bottom of the sidebar, just above GitHub, with a small gold mark) opens the [Lost Ark Tools](https://shotgun175.github.io/) hub, which lists this and the other tools, in a new tab. With the sidebar collapsed it shows only its mark, with a tooltip.
- **Privacy** (footer link): what is stored and why. To report a problem or ask about your data, open an issue on the [GitHub issues page](https://github.com/shotgun175/LostArk-Checklist/issues).

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

- A card at the top shows the roster's **net gold this week**: the gold earned so far, after the chests paid so far, out of what is **possible** (the gold of every planned gold raid of the gold earners, before chests), and how much of it is collected (**% of planned gold collected**). "Earned so far" comes from the raids ticked done on the Checklist. A bar splits the possible gold into earned tradable, earned bound, chests paid and not earned yet, and the legend gives each amount. Under it, one line gives the roster's tradable and bound after chests for what the **Full Planning** switch shows, and how many gold earners there are.
- The page lists your characters on the left: **Gold earners** (characters with Weekly Gold), each with its gold raids, net earned out of possible, the tradable / bound / chests split and a small bar ("No gold raids planned" when there is nothing, "No gold raids, chests -2.5k" when it only buys chests), then **Other characters** with their chest costs. A long name is cut with "..." (hover it for the full name). Hidden characters follow **Show your hidden characters**. With no characters, the page links to the Roster page and to Settings to import a backup.
- Click a character to plan its raids in the panel on the right. The browser remembers the last character you picked. On narrow screens the list sits above the panel.
- For a gold earner, the panel starts with the same summary for that character, plus its gold before chests and where its chests are paid from (for example "Chests 48,640: 16,000 from bound, 32,640 from tradable"). A character that only buys chests shows "Chests only: -2,530" instead. Each raid, and each gate when expanded, says **done**, **to do** or how many gates are done, from the Checklist, on the line under its name.
- A character without Weekly Gold can still pick a difficulty and tick **Taking Chest** (ticking a chest on a gate with no difficulty picks the highest one it can run), but **Taking Gold** is disabled; its chest costs count against that character's own total and the roster total.
- The first time you tick **Taking Gold** on a raid or a gate that has no running mode yet, the Gold Planner picks the highest mode the character's item level allows: Nightmare, then Hard, then Normal. It never picks Solo.
- A mode that is already set (Solo included) is never changed, and unticking then ticking again keeps it.
- A Hard or Nightmare mode saved for a character whose item level is now too low for it counts as the highest mode it can run, for gold, chests and the 3-raid limit, with a note such as "Hard needs 1730, counted as Normal". The saved mode itself is kept; click the note (it ends in **Save as Normal**) or the already selected **Normal** button to save the counted mode instead. The Checklist's corner badge shows the counted mode too (NM in this example), and its tooltip repeats the note.
- When the gates of a raid use different modes, a **Mixed** tag shows next to the mode buttons. **Taking Gold** and **Taking Chest** show their amount once a mode is picked (and the chest only when it costs something), for example "Taking Gold (50,000, all bound)".
- A character earns gold from at most 3 raids a week: once 3 raids have **Taking Gold** ticked, it is disabled on that character's other raids (running mode and **Taking Chest** stay usable) until you untick one. If a character ever has more than 3 (for example from imported data), the Gold Planner keeps the 3 raids that pay the most gold for the selected modes (on a tie, the newer raid), unticks **Taking Gold** on the others, saves that and shows a message for 10 seconds such as "Brakka can take gold from 3 raids a week. Kept Serca, Kazeros, Horizon Cathedral; unticked Armoche.". Totals and the checklist gold coin never count more than 3 raids per character.
- Each character's total and the roster total show two numbers, tradable and bound. Taking Chest costs are paid from that character's own bound gold first, then from its tradable gold, so bound never goes below zero. Raids already done and raids still to do pay their own chests, so bound gold from a raid not run yet never pays a chest already bought: gold earned so far plus **Remaining for the week** always equals **Full Planning**. The roster adds up each character's numbers after chests.
- Chaos Dungeons and Other sources count as tradable gold earned this week; an amount above zero also adds to possible. A negative Other entry (a bus cost) only lowers what is earned. Amounts are whole gold (1234.56 is saved as 1234), between -10,000,000 and 10,000,000, and Enter saves the box.
- The **Full Planning** / **Remaining for the week** switch changes the raids listed and the totals; **Remaining for the week** counts only the gates still to do (Chaos Dungeons and Other sources are already earned, so they are not in it). The summary cards always show earned so far out of possible for the whole week.

### Roster

- At most 6 characters can have **Weekly Gold**, as in the game. Once 6 have it, the box is disabled on the others until you untick one.
- A new character gets Weekly Gold only while fewer than 6 characters have it.
- A roster that already has more than 6 (for example from an import) shows a warning on the Roster page; nothing is unticked for you.
- Names are trimmed, invisible characters are removed and they are at most 16 characters long. An empty name is refused, and the old name shows again. Two characters can have the same name, since names are unique only per region (one on NA and one on EU, for example). Item levels go from 0 to 2000.
- Checkmarks, rest bonus, task tracking, lazy choices, Gold Planner ticks and modes, and Chaos Dungeons and Other sources amounts belong to the character (its internal id), not its name, so two characters with the same name keep their own, and renaming a character keeps them. Deleting a character also deletes them, so a character added later starts with none.
- **Import roster** replaces every character in the roster. It checks each character first (an id, a name, a numeric item level and a known class) and lists what is wrong instead of importing a bad paste.
- Class names are the ones the Global client uses (for example Arcanist, Machinist, Guardian Knight), in alphabetical order. Base classes (Warrior, Mage, Gunner, Assassin) are not offered, but a character saved with one still shows it.
- Each character has a note button: **Add note** when it has none, a blue **Note** when it has one (hover it to read the note). Click it to edit the note in a small popup (up to 500 characters); **Save** keeps it, **Clear** removes it, and clicking outside or pressing Escape closes without saving. The note shows as a hover icon on the Checklist and Gold Planner.
- At phone width each character is a stacked card, with the note button on the name line.

### Tasks Manager

- **Import custom tasks** checks each task (a name, a known frequency and scope, numeric item levels) and skips tasks you already have with the same name and frequency, so importing your own export again adds nothing. **Export** copies only what another account needs (not the task ids).
- A new custom task goes to the end of the list, and the list scrolls to it. The form refuses an empty name, fewer than 1 repetition and a minimum item level above the maximum.
- **Track all tasks** and **Untrack all tasks** ask first.
- **Days** picks the days a task shows on the Checklist. Leave it blank (**Every day**) or pick all 7 for every day.
- The icon picker shows each icon's name and can be searched by typing.
- When the table is wider than the screen it scrolls sideways with the grip and Name columns pinned (screens at least 900 px wide).

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
- Gold Planner: **Full Planning** can show less tradable and more bound gold than before when chests were bought on raids already done while bound gold is still to come from raids not run yet; the old number counted that later bound gold toward chests already paid. **Remaining for the week** no longer adds your Chaos Dungeons and Other sources entries, since they are already earned. A Hard or Nightmare mode saved above a character's item level now counts as the mode it can run. Nothing saved is changed.
- **Howl's Hourglass** is now spelled **Haal's Hourglass**. Your existing task is renamed in place, so its checkmarks and tracking choices carry over and no duplicate appears.
- **Weekly Mission** is gone. It no longer exists in the game, so it is removed from the built-in list and from existing accounts the next time the site loads.
- Lazy choices, Gold Planner ticks and modes, and Chaos Dungeons and Other sources amounts were saved under the character's name. The first time the site loads they move to the character itself, so a rename keeps them. Nothing else changes.
- Two characters can now have the same name. Checkmarks or rest bonus still saved under a character's name (very old data) move to the character itself the next time the Checklist loads; if two characters share that name, each gets its own copy. Nothing else changes.
- If two characters of an older roster share an internal id (a past bug when adding characters), the second one gets a new id the next time the site loads, so editing one no longer overwrites the other. Its checkmarks, rest bonus and per-character choices were shared with the other character, so they start fresh for it.
- Classes saved as numbers by a backup restore now show in the Roster class picker.
- Account records from older versions of this site still held unused fields (friends, region, availability). They are removed the next time you sign in or the site loads, so only your display name is stored there. Nothing you see changes.
- Class names now match the Global client: Arcana shows as **Arcanist** and Scouter as **Machinist**. Saved characters do not change.

## Signing in and syncing

- Without signing in, each browser gets its own anonymous account. Your data is saved, but only in that browser profile. Clearing site data loses it.
- To use the same data on your phone (or on a second PC):
  1. On the PC that already has your data, open the user menu and choose **Register**. Create an account with email and password. Registering upgrades the anonymous account in place: same account, same data.
  2. On the phone, open the user menu, choose **Sign in** and use the same email and password.
- **Sign in is not Register.** On a browser that already has anonymous data, **Sign in** switches to the other account and leaves the anonymous data behind, so it no longer shows (it is not merged). The Sign in popup warns a guest who has characters before this happens, with a **Download backup** button and a **Register instead** link. Use **Register** the first time on the browser that holds your data. The original code also tries to delete the previous anonymous account's tasks during that switch. On this site the database rules block that, so nothing is deleted and the app ignores the refusal.
- **Display name:** shown in the header (a guest shows **Guest**). It is optional when you register; left blank, it is the part of your email before the @. Change it from the user menu, **Change display name**. Names are trimmed, invisible characters are removed, and the limit is 32 characters. You still sign in with your email, not the display name.
- The Sign in and Create an account popups link to each other, and Register, Sign in and Log out each confirm with a short message.
- **Log out** first makes sure every change reached the server, then reloads the page: the account's data is removed from that browser and a fresh, empty anonymous account starts. Your registered account's data is untouched. Sign in again to get it back.
- **Sign in** also reloads the page and removes the previous account's data from that browser (a guest's data stays on the server, see above).
- **Delete my account and data** (Settings) deletes everything stored for your account and then the account. Registered users confirm with their password. For a guest it deletes the data and starts a new guest account.
- Log out, Sign in and account deletion reload every open tab of the site in that browser.

## Offline

The site keeps a copy of your data in the browser (Firestore's IndexedDB cache, shared by all open tabs). If the connection drops while the site is open, it keeps working: ticks and edits are saved on the device and sent when you are back online, even if you close the tab first.

- Data from another device shows as soon as the site reaches the server again. Until then you see this device's last copy.
- The daily rest bonus update and other automatic fixes to your data wait until the device is online, so they never write an old copy over newer data.
- A page whose data was never loaded on this device stays empty until the device is online.
- **Log out**, **Sign in**, **Register**, **Delete my account and data**, **Import from Lostark-helper**, **Restore backup** and **Download backup** need the server. Offline they show "You're offline. Connect to the internet to ...". Log out, Sign in and account deletion also wait until every change made on the device has reached the server; if that takes more than 10 seconds they are refused, so nothing is lost.
- After one visit online, the site also opens with no connection at all: a service worker keeps the app itself on the device. A banner says when you are offline. Each icon or image loads offline once it has been shown online.
- A brand new visitor who opens the site offline gets an empty page until the device is online, because a guest account can only be created on the server.

## Install on your phone

The site can be added to your home screen. It then opens full screen, without the browser's address bar and toolbars, with its own icon.

- **iPhone (Safari or Chrome):** tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** open the menu (three dots), then **Add to Home screen** or **Install app**.

After the first visit the installed app (and the site in the browser) opens and works offline; see **Offline** above. When a new version of the site is out, it downloads in the background and a banner says **A new version is available.** Click **Reload** to switch to it; ticks made before that are sent first. Without a click, the new version loads the next time the site is opened after every tab of it was closed.

**Register before you install on an iPhone.** An app added to an iPhone home screen keeps its own storage, apart from the browser. A guest's data stays in the browser and the installed app starts as a new, empty guest. With an account, just sign in inside the installed app (see **Signing in and syncing** above).

## Bringing data over from lostark-helper.com

### The one-click bookmark (computer)

1. On this site, open **Settings**, **Bring data over**, and drag the **Send to Lost Ark Checklist** button to your browser's bookmarks bar. You only do this once.
2. Open https://lostark-helper.com/checklist (signed in as you, if you use an account there) and wait for your checklist to load. Opening the checklist first also brings the rest bonus up to date.
3. Click the **Send to Lost Ark Checklist** bookmark. This site opens in a new tab on **Settings** with your data and its counts. Click **Import this file** and confirm. Nothing is changed until you confirm.

If the browser blocks the new tab, allow pop-ups for lostark-helper.com and click the bookmark again, or use the console steps below. The bookmark only works on lostark-helper.com; it sends the data only to this site, and this site only accepts it from lostark-helper.com.

### The console script (fallback)

1. In the same browser profile where you use lostark-helper.com, open https://lostark-helper.com/checklist (signed in as you, if you use an account there) and wait for the checklist to load.
2. On this site, open **Settings**, **Bring data over**, **how to export**, and click **Copy script** (it copies `tools/export-from-lostark-helper.js`). Back on lostark-helper.com, press F12, open the Console tab, paste and press Enter. If the browser shows a warning about pasting instead of running it, type `allow pasting`, press Enter, then paste again and press Enter. The browser downloads `lostark-helper-export-<date>.json`, and the console shows `Export done: N characters, N tasks, N completion entries`.
3. On this site, open **Settings**, **Bring data over**, **Import from Lostark-helper**, and pick the file. Check the counts, then click **Import this file** and confirm. The page reloads when the import is done.

The import replaces this account's roster, tasks, ticks, rest bonus and settings. Tasks get new ids in this account and ticks, tracking and lazy flags are moved to them, so the same file can be imported into more than one account. Raid tracking choices from lostark-helper.com are not brought over, so every character starts on its 3 newest raids; daily and weekly choices are kept. Choices for tasks that are not in the file are dropped. The bookmark and the script read only your own documents with your own sign-in. Export right before you import, so the rest bonus and ticks are current.

## Backups

- **Download backup** (Settings, Bring data over) saves this account's data as a JSON file.
- **Restore backup** imports such a file. It uses the same format as the lostark-helper.com export and replaces the same data. Unlike **Import from Lostark-helper**, it keeps your raid tracking choices.
- Backups also hold your display name, and **Restore backup** brings it back. A backup made before this change has none, and then your current name is kept. **Import from Lostark-helper** never changes the display name.
- After an import or a restore, other open tabs of the same account in this browser reload by themselves, so they cannot write their old data over the new one.

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

### Service worker

The service worker (`@angular/service-worker`, configured in `apps/client/ngsw-config.json`) is only in production and emulator builds. `nx serve` never runs it, in any configuration, so day to day development is not affected by it. It keeps the app itself (`index.html`, scripts, styles, the manifest) for offline use, loads images and the ng-zorro icons into its cache the first time they are shown, and serves `/assets/export-from-lostark-helper.js` from the network with the last copy as an offline fallback. Firebase and Google requests never go through its cache.

To test it against the local emulators (they must be running, see below):

```bash
npx nx build client --configuration=emulator     # includes ngsw-worker.js and ngsw.json
npx -y serve -s dist/apps/client/browser -l 4300 # static server with SPA fallback, http://localhost:4300
```

Open http://localhost:4300, wait about 30 seconds (the worker registers once the app has settled), then use DevTools, **Application**, **Service workers** and the **Offline** checkbox (or the Network tab) and reload. http://localhost:4300/ngsw/state shows the worker's state. To see the new version banner, rebuild while the page is open, then switch tabs or reload once.

To remove a stale worker from your browser: DevTools, **Application**, **Service workers**, **Unregister**, then **Storage**, **Clear site data**. Or run this in the page's console and reload:

```js
navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.unregister()));
```

A worker belongs to one origin, so one on port 4300 never affects `nx serve` on port 4200.

### Local emulators

Point `JAVA_HOME` at your Java install and put its `bin` folder on `PATH`, then start Auth and Firestore (Git Bash, macOS or Linux shell; the path is an example):

```bash
export JAVA_HOME="/c/path/to/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
npx -y firebase-tools emulators:start --only auth,firestore --project demo-loa-checklist
```

Auth runs on port 9099 and Firestore on 8085 (see `firebase.json`). In a second terminal run `npx nx serve client --configuration=emulator`. That configuration uses the project id `demo-loa-checklist`, which can never reach a real project, and App Check is off there. The emulators start empty every time.

For test data, open http://localhost:4200/settings, choose **Bring data over**, **Import from Lostark-helper** and pick `tools/fixtures/lostark-helper-export-synthetic.json` (15 made-up characters, 6 of them visible). Never use a real export for local testing.

To try the one-click bookmark locally, serve a stand-in page for lostark-helper.com at http://localhost:4320/checklist. Only the emulator configuration accepts that origin (see `importBridge` in `apps/client/src/environments/environment.emulator.ts`); production accepts only https://lostark-helper.com. The bookmark reads the signed-in user from the `firebaseLocalStorageDb` IndexedDB database and calls `securetoken.googleapis.com` and `firestore.googleapis.com`, so a stand-in page has to seed that database and answer those requests from a synthetic fixture.

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

The build lands in `dist/apps/client/browser`, which `firebase.json` serves. After a deploy, check that the service worker files and the page itself are never cached (each should print `cache-control: no-cache`), and that a hashed script still is (`public,max-age=31536000,immutable`):

```bash
for path in / /index.html /settings /ngsw.json /ngsw-worker.js /safety-worker.js /manifest.webmanifest /assets/export-from-lostark-helper.js; do
  printf '%s: ' "$path"; curl -sI "https://loa-checklist.web.app$path" | grep -i '^cache-control'
done
curl -sI "https://loa-checklist.web.app/$(ls dist/apps/client/browser | grep -m1 '^main-.*\.js$')" | grep -i '^cache-control'
```

Open tabs pick up the new version through the **A new version is available.** banner.

**Kill switch.** If a release breaks the service worker, deploy the safety worker in its place. It unregisters itself and deletes the worker's caches on every device the next time the site is opened, and the site then loads from the network as before:

```bash
npx nx build client
cp dist/apps/client/browser/safety-worker.js dist/apps/client/browser/ngsw-worker.js
npx -y firebase-tools deploy --only hosting --project loa-checklist
```

Deleting `ngsw.json` from the build is not a kill switch here: the SPA rewrite answers the missing file with `index.html`, and the worker only turns itself off on a 404. To bring the worker back, deploy a normal build again. The last command checks the deployed database rules: it creates two throwaway guest accounts in the live project, tries allowed and forbidden reads and writes, then deletes everything it created and both accounts. Pushes to master only run CI (build and unit tests); deploys are always manual.

## Firebase plan

The project stays on the free Spark plan. On Spark, a product that goes over its quota stops working until the quota resets; it never bills. The limits that matter here:

- **Firestore**: 1 GiB stored, 50,000 document reads, 20,000 writes and 20,000 deletes a day, 10 GiB a month of downloads.
- **Hosting**: 10 GB stored, 360 MB of downloads a day. With the service worker, each visitor downloads the whole app (about 2.7 MB, under 1 MB compressed) once per release, even pages they do not open.
- **Authentication**: email and password plus guest (anonymous) sign-in, free up to 50,000 monthly active users.
- **App Check**: reCAPTCHA Enterprise includes 10,000 free assessments a month. The 7 day App Check token lifetime keeps usage far below that.

The app saves ticks and toggles as small field updates grouped about once a second per document, which keeps writes well inside the daily quota.

If the project ever moves to the Blaze plan (for example for Cloud Functions), first create a budget alert in Google Cloud console, Billing, Budgets and alerts, with a small amount and alerts at 50, 90 and 100 percent. Budget alerts warn; they do not cap spending.

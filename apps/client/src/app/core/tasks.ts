import { createTask } from "../model/lostark-task";
import { TaskFrequency } from "../model/task-frequency";
import { TaskScope } from "../model/task-scope";

export const tasks = [
  // Daily character
  createTask("Chaos Dungeon", 302, TaskFrequency.DAILY, TaskScope.CHARACTER, 1, 9999, "chaos-dungeon.webp", {
    partySize: 4
  }),
  createTask("Guardian", 302, TaskFrequency.DAILY, TaskScope.CHARACTER, 1, 9999, "guardian.png", {
    shared: true,
    partySize: 4
  }),
  createTask(`Una's Task`, 302, TaskFrequency.DAILY, TaskScope.CHARACTER, 3, 9999, "daily.webp"),
  createTask(`Kalthertz Slaves`, 302, TaskFrequency.DAILY, TaskScope.CHARACTER, 1, 9999, "pirate_coin.png"),
  createTask(`Guild Support`, 0, TaskFrequency.DAILY, TaskScope.CHARACTER, 1, 9999, "sylmael.png"),


  // Daily roster
  createTask("Chaos Gate", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 1, 9999, "chaos_gate.png", {
    daysFilter: [1, 4, 6, 0],
    canEditDaysFilter: false,
  }),
  createTask("Anguished Island", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 1, 9999, "anguished.png"),
  createTask("Adventure Island", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 1, 9999, "island.webp"),
  createTask("Procyon Boss", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 1, 9999, "island.webp", {
    daysFilter: [2, 5, 0],
    canEditDaysFilter: false,
  }),
  createTask("Affinity Song", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 5, 9999, "rapport.webp"),
  createTask("Affinity Emote", 302, TaskFrequency.DAILY, TaskScope.ROSTER, 5, 9999, "rapport.webp"),

  // Weekly Character
  createTask(`Paradise`, 1580, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 5, 9999, "weekly.webp"),
  createTask(`Haal's Hourglass`, 1730, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, "weekly.webp"),
  createTask(`Demon Beast Canyon`, 340, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 840, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Necromancer's Origin`, 340, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 840, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Hall of the Twisted Warlord`, 460, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 960, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Hildebrandt Palace`, 460, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 960, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Road of Lament`, 840, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1325, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Forge of Fallen Pride`, 840, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1325, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Sea of Indolence`, 960, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1370, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Tranquil Karkosa`, 960, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1370, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Alaric's Sanctuary`, 960, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1370, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Aira's Oculus`, 1325, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1415, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Oreha Preveza`, 1340, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 1415, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Argos`, 1370, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 1475, "abyssal-raid.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Valtan`, 1415, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Vykas`, 1430, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Kakul-Saydon`, 1475, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "legion_raid.png", {
    shared: true,
    partySize: 4
  }),
  createTask(`Brelshaza Gate 1-2`, 1490, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Brelshaza Gate 3`, 1500, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Brelshaza Gate 4`, 1520, TaskFrequency.BIWEEKLY, TaskScope.CHARACTER, 1, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Kayangel`, 1540, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Akkan`, 1580, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Ivory Tower`, 1600, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),
  createTask(`Thaemine`, 1610, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Thaemine G4`, 1620, TaskFrequency.BIWEEKLY_OFFSET, TaskScope.CHARACTER, 1, 9999, "legion_raid.png", {
    shared: true,
    partySize: 8
  }),
  createTask(`Echidna`, 1620, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Behemoth`, 1620, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 16
  }),
  createTask(`Aegir`, 1660, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
  createTask(`Brelshaza Chapter 2`, 1670, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
    createTask(`Mordum`, 1680, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 3, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
    createTask(`Armoche`, 1700, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
    createTask(`Kazeros`, 1710, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 8
  }),
    createTask(`Serca`, 1710, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "kazeros-raid.webp", {
    shared: true,
    partySize: 4
  }),
    createTask(`Horizon Cathedral`, 1700, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 2, 9999, "abyssal-dungeon.webp", {
    shared: true,
    partySize: 4
  }),

  // Weekly Roster
  createTask(`South Vern Chaos Line Dungeon`, 1340, TaskFrequency.WEEKLY, TaskScope.ROSTER, 2, 9999, "dungeon.webp"),

  createTask("Primal Island Battle Royale", 1490, TaskFrequency.WEEKLY, TaskScope.ROSTER, 9, 9999, "event_quest.webp", {
    daysFilter: [2, 4, 6],
    canEditDaysFilter: false,
  }),
  //createTask(`Trial of the Abyss`, 460, TaskFrequency.WEEKLY, TaskScope.ROSTER, 2),

  // Trades
  createTask(`Sylmael Bloodstones Purchases`, 302, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, "sylmael.png"),
  createTask(`Pirate Coin Purchases`, 302, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, "pirate_coin.png"),
  createTask(`Chaos Purchases`, 302, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, "chaos-dungeon.webp")
];

/**
 * Raids in release order, newest first. Each entry is one raid and lists all of its task labels
 * from the list above. A character tracks the 3 newest raids it can enter by default
 * (see core/task-tracking.ts). Add a new raid at the top when its task is added.
 */
export const raidReleaseOrder: string[][] = [
  [`Horizon Cathedral`],
  [`Serca`],
  [`Kazeros`],
  [`Armoche`],
  [`Mordum`],
  [`Brelshaza Chapter 2`],
  [`Aegir`],
  [`Behemoth`],
  [`Echidna`],
  [`Thaemine`, `Thaemine G4`],
  [`Ivory Tower`],
  [`Akkan`],
  [`Kayangel`],
  [`Brelshaza Gate 1-2`, `Brelshaza Gate 3`, `Brelshaza Gate 4`],
  [`Kakul-Saydon`],
  [`Vykas`],
  [`Valtan`],
  [`Argos`],
  // Abyssal dungeons, newest tier first
  [`Oreha Preveza`],
  [`Aira's Oculus`],
  [`Alaric's Sanctuary`],
  [`Tranquil Karkosa`],
  [`Sea of Indolence`],
  [`Forge of Fallen Pride`],
  [`Road of Lament`],
  [`Hildebrandt Palace`],
  [`Hall of the Twisted Warlord`],
  [`Necromancer's Origin`],
  [`Demon Beast Canyon`]
];

// Built-in tasks that no character tracks by default (auto mode). A user switches them on per character in
// Settings > Task tracking; an explicit choice always wins. Custom tasks with the same label are not affected.
export const defaultOffTaskLabels = [
  "Kalthertz Slaves",
  "Una's Task"
];

// Built-in tasks whose label changed: old label to new label. Existing copies are renamed in place, keeping their key,
// so checkmarks and tracking choices carry over and no duplicate task is created.
export const renamedTaskLabels: Record<string, string> = {
  "Howl's Hourglass": "Haal's Hourglass"
};

// Built-in tasks that no longer exist in the game: removed from the default list and deleted from every account on load.
export const oldTaskNames = [
  "South Vern Dungeon",
  "Challenge Guardian",
  "Challenge Abyssal Dungeon",
  "Weekly Mission"
]
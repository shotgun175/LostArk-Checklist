import { LostarkClass } from "./lostark-class";

/**
 * Class names as the Global (English) client shows them. The enum keeps its upstream names
 * (ARCANA, SCOUTER, ...), since saved characters store the enum number.
 */
const NAMES: Record<LostarkClass, string> = {
  [LostarkClass.DESTROYER]: "Destroyer",
  [LostarkClass.UNRELEASED]: "Unknown class",
  [LostarkClass.ARCANA]: "Arcanist",
  [LostarkClass.BERSERKER]: "Berserker",
  [LostarkClass.WARDANCER]: "Wardancer",
  [LostarkClass.DEADEYE]: "Deadeye",
  [LostarkClass.UNRELEASED0]: "Unknown class",
  [LostarkClass.GUNLANCER]: "Gunlancer",
  [LostarkClass.GUNNER]: "Gunner",
  [LostarkClass.SCRAPPER]: "Scrapper",
  [LostarkClass.MAGE]: "Mage",
  [LostarkClass.SUMMONER]: "Summoner",
  [LostarkClass.WARRIOR]: "Warrior",
  [LostarkClass.SOULFIST]: "Soulfist",
  [LostarkClass.SHARPSHOOTER]: "Sharpshooter",
  [LostarkClass.ARTILLERIST]: "Artillerist",
  [LostarkClass.BARD]: "Bard",
  [LostarkClass.GLAIVIER]: "Glaivier",
  [LostarkClass.ASSASSIN]: "Assassin",
  [LostarkClass.DEATHBLADE]: "Deathblade",
  [LostarkClass.SHADOWHUNTER]: "Shadowhunter",
  [LostarkClass.PALADIN]: "Paladin",
  [LostarkClass.SCOUTER]: "Machinist",
  [LostarkClass.REAPER]: "Reaper",
  [LostarkClass.UNRELEASED4]: "Unknown class",
  [LostarkClass.GUNSLINGER]: "Gunslinger",
  [LostarkClass.UNRELEASED5]: "Unknown class",
  [LostarkClass.STRIKER]: "Striker",
  [LostarkClass.SORCERESS]: "Sorceress",
  [LostarkClass.ARTIST]: "Artist",
  [LostarkClass.SLAYER]: "Slayer",
  [LostarkClass.AEROMANCER]: "Aeromancer",
  [LostarkClass.SOULEATER]: "Souleater",
  [LostarkClass.BREAKER]: "Breaker",
  [LostarkClass.WILDSOUL]: "Wildsoul",
  [LostarkClass.VALKYRIE]: "Valkyrie",
  [LostarkClass.GUARDIANKNIGHT]: "Guardian Knight",
  [LostarkClass.DIMENTIONALIST]: "Dimensionalist"
};

/** Base classes and unreleased placeholders: never offered, but still named for characters saved with them. */
const NOT_PICKABLE = new Set<LostarkClass>([
  LostarkClass.UNRELEASED,
  LostarkClass.UNRELEASED0,
  LostarkClass.UNRELEASED4,
  LostarkClass.UNRELEASED5,
  LostarkClass.GUNNER,
  LostarkClass.MAGE,
  LostarkClass.WARRIOR,
  LostarkClass.ASSASSIN
]);

export interface ClassOption {
  id: LostarkClass;
  name: string;
  icon: string;
  /** Left out of the dropdown list; the option still exists so a saved character shows its class. */
  hide: boolean;
}

export function classDisplayName(id: LostarkClass): string {
  return NAMES[id];
}

/** Every class, alphabetical by Global name. */
export const CLASS_OPTIONS: ClassOption[] = (Object.keys(NAMES).map(Number) as LostarkClass[])
  .map(id => ({
    id,
    name: NAMES[id],
    icon: `class_${String(id).padStart(2, "0")}.png`,
    hide: NOT_PICKABLE.has(id)
  }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);

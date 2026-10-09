import { DataModel } from "../core/database/data-model";

export interface ManualWeeklyGoldEntry {
  timestamp: number;
  amount: number;
}

export interface Settings extends DataModel {
  hiddenOnCompletion: boolean;
  // No longer used (Affinity is always 5). Kept so old exports and backups import, and new accounts keep their key count.
  crystallineAura: boolean;
  lazytracking: Record<string, boolean>;
  manualGoldEntries: Record<string, ManualWeeklyGoldEntry>;
  // True = skip chest, False = take chest
  chestConfiguration: Record<string, boolean>;
    // True = skip gold, False = take gold
  goldPlannerConfiguration: Record<string, boolean>;
  raidModesForGoldPlanner: Record<string, string>;
  forceAbyss: Record<string, boolean>;
}

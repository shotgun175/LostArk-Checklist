import { DataModel } from "../database/data-model";
import { Roster } from "../../model/roster";
import { Settings } from "../../model/settings";
import { Completion } from "../../model/completion";
import { Energy } from "../../model/energy";
import { LostarkTask } from "../../model/lostark-task";

export const EXPORT_FORMAT = 1;

/** A document as stored in Firestore: without the client-only DataModel fields. */
export type StoredDoc<T> = Omit<T, keyof DataModel>;

/**
 * File format shared by the lostark-helper.com export snippet, "Download backup" and
 * "Restore backup". Tasks keep their document id as $key.
 */
export interface LostarkExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: string;
  sourceUid: string;
  roster: StoredDoc<Roster>;
  settings: Partial<StoredDoc<Settings>>;
  completion: StoredDoc<Completion> | null;
  energy: StoredDoc<Energy> | null;
  tasks: LostarkTask[];
  /**
   * The account's display name (users/{uid}). Only this app's backups have it; files from older
   * backups and the lostark-helper.com snippet do not, and then the current name is kept.
   */
  user?: { name: string } | null;
}

// One entry per Settings field. The Record type makes the compiler flag this list
// whenever the Settings model gains or loses a field.
const SETTINGS_FIELDS: Record<keyof StoredDoc<Settings>, true> = {
  hiddenOnCompletion: true,
  crystallineAura: true, // ignored; still accepted so old exports and backups import
  lazytracking: true,
  manualGoldEntries: true,
  chestConfiguration: true,
  goldPlannerConfiguration: true,
  raidModesForGoldPlanner: true,
  forceAbyss: true
};

/** Settings keys this fork uses; any other key in an imported file is dropped. */
export const SETTINGS_KEYS = Object.keys(SETTINGS_FIELDS) as (keyof StoredDoc<Settings>)[];

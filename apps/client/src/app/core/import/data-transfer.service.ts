import { Inject, Injectable } from "@angular/core";
import { collection, doc, Firestore, getDoc, getDocs, getDocsFromServer, query, where, writeBatch } from "firebase/firestore";
import { FIRESTORE } from "../firebase/firebase.providers";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../database/services/auth.service";
import { FirestoreStorage } from "../database/firestore-storage";
import { EXPORT_FORMAT, LostarkExport } from "./lostark-export";
import { FIRESTORE_BATCH_LIMIT, planImportWrites } from "./plan-import-writes";
import { DATA_REPLACED_CHANNEL, TAB_ID } from "../firebase/local-data.service";
import { ServerConnectionService } from "../firebase/server-connection.service";

@Injectable({
  providedIn: "root"
})
export class DataTransferService {

  /** This tab's id in channel messages (a field so tests can play another tab). */
  protected tabId = TAB_ID;

  constructor(@Inject(FIRESTORE) private firestore: Firestore, private auth: AuthService,
              private connection: ServerConnectionService) {
  }

  /**
   * Reloads this tab when another tab of the same account finishes an import or restore. Until the
   * reload it writes nothing, so its old data (ticks on screen, the old task list) cannot be written
   * over the imported data. Field changes still waiting here are dropped: the import replaced them.
   * Log out, Sign in and account deletion in another tab reload every tab (cleared): the data saved
   * in this browser is deleted on the next load, and this tab would otherwise show the old account.
   * Before such a change, that tab asks this one to send its queued field changes (flush) while the
   * account that made them is still signed in.
   */
  public reloadWhenReplacedInAnotherTab(): void {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }
    let currentUid: string | null = null;
    this.auth.uid$.subscribe(uid => currentUid = uid);
    const channel = new BroadcastChannel(DATA_REPLACED_CHANNEL);
    channel.onmessage = (event: MessageEvent<{ uid?: string, tabId?: string, cleared?: boolean, flush?: boolean }>) => {
      if (event.data?.tabId === this.tabId) {
        return;
      }
      if (event.data?.flush) {
        FirestoreStorage.flushPending();
        return;
      }
      if (event.data?.cleared || (currentUid !== null && event.data?.uid === currentUid)) {
        FirestoreStorage.pauseWrites();
        this.reloadPage();
      }
    };
  }

  /** A method of its own so tests can replace it (jsdom cannot reload). */
  public reloadPage(): void {
    window.location.reload();
  }

  private announceDataReplaced(uid: string): void {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }
    const channel = new BroadcastChannel(DATA_REPLACED_CHANNEL);
    channel.postMessage({ uid, tabId: this.tabId });
    channel.close();
  }

  /**
   * Replaces the current user's roster, settings, completion, energy and tasks with an
   * export, in one atomic batch. The page must be reloaded afterwards because service writes stay
   * paused until then (the services would otherwise answer the new data with the old task list). A Lostark-helper file
   * (fromLostarkHelper) also drops its raid tracking choices, so raids start on automatic, and never
   * changes the display name. Other open tabs of the same account reload once the batch is written.
   * It needs the server: offline it rejects with a ConnectionRequiredError and changes nothing, and
   * the task list to replace is read from the server, so no old task is missed.
   */
  public async importExport(data: LostarkExport, fromLostarkHelper = false): Promise<void> {
    await this.connection.requireServer("import or restore data");
    const uid = await firstValueFrom(this.auth.uid$);
    const existingTasks = await getDocsFromServer(query(collection(this.firestore, "tasks"), where("authorId", "==", uid)));
    const file: LostarkExport = fromLostarkHelper ? { ...data, user: null } : data;
    const { writes } = planImportWrites(uid, existingTasks.docs.map(task => task.id), file,
      () => doc(collection(this.firestore, "tasks")).id, fromLostarkHelper);
    if (writes.length > FIRESTORE_BATCH_LIMIT) {
      throw new Error(`This import needs ${writes.length} writes, more than the ${FIRESTORE_BATCH_LIMIT} Firestore allows in one batch. Nothing was changed.`);
    }
    const batch = writeBatch(this.firestore);
    writes.forEach(write => {
      const ref = doc(this.firestore, write.collection, write.id);
      if (write.op === "delete") {
        batch.delete(ref);
      } else {
        batch.set(ref, write.data);
      }
    });
    // Send field changes still waiting in their one-second window now, so they land before the
    // import replaces these documents instead of on top of it.
    FirestoreStorage.flushPending();
    // Until the reload, the services would answer the new documents with the old task list (for
    // example the daily rest bonus update for a file saved before the last reset), so they stop writing.
    // This also means no tick on screen from before the import can be written over it: the pause
    // starts before the batch is handed to the SDK, with no await in between. The live listeners show
    // the batch at once, and if the server refuses it, the SDK's rollback shows the old data again.
    FirestoreStorage.pauseWrites();
    try {
      await batch.commit();
    } catch (error) {
      FirestoreStorage.resumeWrites();
      throw error;
    }
    this.announceDataReplaced(uid);
  }

  /**
   * The current user's data as an export file. It needs the server (offline it rejects with a
   * ConnectionRequiredError): read from this device's cache, the task list could be incomplete.
   */
  public async buildBackup(): Promise<LostarkExport> {
    await this.connection.requireServer("download a backup");
    const uid = await firstValueFrom(this.auth.uid$);
    const [roster, settings, completion, energy, user] = await Promise.all(
      ["roster", "settings", "completion", "energy", "users"].map(name => getDoc(doc(this.firestore, name, uid)))
    );
    const name = user.data()?.["name"];
    const tasks = await getDocs(query(collection(this.firestore, "tasks"), where("authorId", "==", uid)));
    return {
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      sourceUid: uid,
      // Same defaults as RosterService and an empty settings map, so a backup of an account
      // that never saved these documents can still be restored.
      roster: (roster.data() ?? { characters: [], trackedTasks: {}, showAllTasks: false }) as LostarkExport["roster"],
      settings: (settings.data() ?? {}) as LostarkExport["settings"],
      completion: (completion.data() ?? null) as LostarkExport["completion"],
      energy: (energy.data() ?? null) as LostarkExport["energy"],
      tasks: tasks.docs.map(task => ({ ...task.data(), $key: task.id }) as LostarkExport["tasks"][number]),
      user: typeof name === "string" && name ? { name } : null
    };
  }

  public async downloadBackup(): Promise<void> {
    const backup = await this.buildBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `loa-checklist-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

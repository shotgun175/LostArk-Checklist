import { Inject, Injectable } from "@angular/core";
import { collection, doc, Firestore, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { FIRESTORE } from "../firebase/firebase.providers";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../database/services/auth.service";
import { CompletionService } from "../database/services/completion.service";
import { FirestoreStorage } from "../database/firestore-storage";
import { EXPORT_FORMAT, LostarkExport } from "./lostark-export";
import { FIRESTORE_BATCH_LIMIT, planImportWrites } from "./plan-import-writes";

@Injectable({
  providedIn: "root"
})
export class DataTransferService {

  constructor(@Inject(FIRESTORE) private firestore: Firestore, private auth: AuthService,
              private completionService: CompletionService) {
  }

  /**
   * Replaces the current user's roster, settings, completion, energy and tasks with an
   * export, in one atomic batch. The page must be reloaded afterwards because roster and
   * completion streams keep their first snapshot in memory, and service writes stay paused. A Lostark-helper file
   * (fromLostarkHelper) also drops its raid tracking choices, so raids start on automatic.
   */
  public async importExport(data: LostarkExport, fromLostarkHelper = false): Promise<void> {
    const uid = await firstValueFrom(this.auth.uid$);
    const existingTasks = await getDocs(query(collection(this.firestore, "tasks"), where("authorId", "==", uid)));
    const { writes, completion } = planImportWrites(uid, existingTasks.docs.map(task => task.id), data,
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
    // Give the in-memory completion the imported ticks before the energy document changes,
    // so the rest bonus update in EnergyService cannot write the old ticks back. If the batch
    // fails, put the previous ticks back so the next checklist tick cannot write the file's.
    const previous = JSON.parse(JSON.stringify(await firstValueFrom(this.completionService.completion$)));
    this.completionService.setLocal(uid, { ...JSON.parse(JSON.stringify(completion)), $key: uid });
    // Send field changes still waiting in their one-second window now, so they land before the
    // import replaces these documents instead of on top of it.
    FirestoreStorage.flushPending();
    // Until the reload, the services would answer the new documents with the old task list (for
    // example the daily rest bonus update for a file saved before the last reset), so they stop writing.
    FirestoreStorage.pauseWrites();
    try {
      await batch.commit();
    } catch (error) {
      FirestoreStorage.resumeWrites();
      this.completionService.setLocal(uid, previous);
      throw error;
    }
  }

  public async buildBackup(): Promise<LostarkExport> {
    const uid = await firstValueFrom(this.auth.uid$);
    const [roster, settings, completion, energy] = await Promise.all(
      ["roster", "settings", "completion", "energy"].map(name => getDoc(doc(this.firestore, name, uid)))
    );
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
      tasks: tasks.docs.map(task => ({ ...task.data(), $key: task.id }) as LostarkExport["tasks"][number])
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

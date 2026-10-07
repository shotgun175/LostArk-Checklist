import { Injectable } from "@angular/core";
import { collection, doc, Firestore, getDoc, getDocs, query, where, writeBatch } from "@angular/fire/firestore";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../database/services/auth.service";
import { CompletionService } from "../database/services/completion.service";
import { EXPORT_FORMAT, LostarkExport } from "./lostark-export";
import { FIRESTORE_BATCH_LIMIT, importedCompletion, planImportWrites } from "./plan-import-writes";

@Injectable({
  providedIn: "root"
})
export class DataTransferService {

  constructor(private firestore: Firestore, private auth: AuthService,
              private completionService: CompletionService) {
  }

  /**
   * Replaces the current user's roster, settings, completion, energy and tasks with an
   * export, in one atomic batch. The page must be reloaded afterwards because roster and
   * completion streams keep their first snapshot in memory.
   */
  public async importExport(data: LostarkExport): Promise<void> {
    const uid = await firstValueFrom(this.auth.uid$);
    const existingTasks = await getDocs(query(collection(this.firestore, "tasks"), where("authorId", "==", uid)));
    const writes = planImportWrites(uid, existingTasks.docs.map(task => task.id), data);
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
    // so the rest bonus update in EnergyService cannot write the old ticks back.
    this.completionService.setLocal(uid, { ...JSON.parse(JSON.stringify(importedCompletion(data))), $key: uid });
    await batch.commit();
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
      roster: roster.data() as LostarkExport["roster"],
      settings: settings.data() as LostarkExport["settings"],
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

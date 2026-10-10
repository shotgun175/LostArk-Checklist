import { inject, Injectable } from "@angular/core";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { collection, doc, getDocsFromServer, query, where, writeBatch } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "../firebase/firebase.providers";
import { FirestoreStorage } from "../database/firestore-storage";
import { planAccountDeletion } from "./plan-account-deletion";
import { LocalDataService } from "../firebase/local-data.service";

export type AccountDeletionResult = "account-deleted" | "guest-data-deleted";

@Injectable({
  providedIn: "root"
})
export class AccountDeletionService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FIRESTORE);
  private readonly localData = inject(LocalDataService);

  /**
   * Deletes everything stored for the signed-in user. A registered user confirms with the
   * password first, so the account deletion cannot fail for an old sign-in after the data is
   * gone. A guest cannot re-authenticate: the data is deleted and the guest is signed out.
   * It needs the server: offline it rejects with a ConnectionRequiredError before anything is
   * deleted, and the task list is read from the server, so no task is left behind.
   * Service writes stay paused afterwards (queued changes are dropped, not written), so the
   * caller reloads the page, which also deletes the data saved on this device.
   */
  public async deleteAccountAndData(password: string): Promise<AccountDeletionResult> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("Not signed in.");
    }
    // Changes still queued here reach the server first, so none of them can bring a document back.
    // From here on nothing new is written until the reload, or until cancelClear after a failure.
    await this.localData.syncBeforeAccountChange("delete your account");
    try {
      if (!user.isAnonymous) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
      }
      const tasks = await getDocsFromServer(query(collection(this.firestore, "tasks"), where("authorId", "==", user.uid)));
      FirestoreStorage.pauseWrites();
      for (const targets of planAccountDeletion(user.uid, tasks.docs.map(task => task.id))) {
        const batch = writeBatch(this.firestore);
        targets.forEach(target => batch.delete(doc(this.firestore, target.collection, target.id)));
        await batch.commit();
      }
      // Before the account goes, so no new guest starts until the reload has cleared this device.
      this.localData.requestClear();
      let result: AccountDeletionResult;
      if (user.isAnonymous) {
        await signOut(this.auth);
        result = "guest-data-deleted";
      } else {
        await deleteUser(user);
        result = "account-deleted";
      }
      // Only now the other tabs reload: started before, they would still have the deleted account
      // and could write its documents again.
      this.localData.announceCleared();
      return result;
    } catch (error) {
      // A wrong password, or a failure before the account went: writing resumes, the clear request
      // is dropped and the account stays (with whatever data was already deleted).
      this.localData.cancelClear();
      throw error;
    }
  }
}

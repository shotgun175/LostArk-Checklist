import { inject, Injectable } from "@angular/core";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { FIREBASE_AUTH, FIRESTORE } from "../firebase/firebase.providers";
import { FirestoreStorage } from "../database/firestore-storage";
import { planAccountDeletion } from "./plan-account-deletion";

export type AccountDeletionResult = "account-deleted" | "guest-data-deleted";

@Injectable({
  providedIn: "root"
})
export class AccountDeletionService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FIRESTORE);

  /**
   * Deletes everything stored for the signed-in user. A registered user confirms with the
   * password first, so the account deletion cannot fail for an old sign-in after the data is
   * gone. A guest cannot re-authenticate: the data is deleted and the guest is signed out.
   * Service writes stay paused afterwards (queued changes are dropped, not written), so the
   * caller reloads the page.
   */
  public async deleteAccountAndData(password: string): Promise<AccountDeletionResult> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("Not signed in.");
    }
    if (!user.isAnonymous) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
    }
    const tasks = await getDocs(query(collection(this.firestore, "tasks"), where("authorId", "==", user.uid)));
    FirestoreStorage.pauseWrites();
    try {
      for (const targets of planAccountDeletion(user.uid, tasks.docs.map(task => task.id))) {
        const batch = writeBatch(this.firestore);
        targets.forEach(target => batch.delete(doc(this.firestore, target.collection, target.id)));
        await batch.commit();
      }
      if (user.isAnonymous) {
        await signOut(this.auth);
        return "guest-data-deleted";
      }
      await deleteUser(user);
      return "account-deleted";
    } catch (error) {
      FirestoreStorage.resumeWrites();
      throw error;
    }
  }
}

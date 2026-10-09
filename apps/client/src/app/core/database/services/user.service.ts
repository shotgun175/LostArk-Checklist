import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { LAHUser } from "../../../model/lah-user";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { AuthService } from "./auth.service";
import { combineLatest, EMPTY, filter, map, Observable, of, scan, shareReplay, switchMap, take } from "rxjs";
import { TextQuestionPopupComponent } from "../../../components/text-question-popup/text-question-popup/text-question-popup.component";
import { NzModalService } from "ng-zorro-antd/modal";
import { cleanDisplayName, DISPLAY_NAME_MAX_LENGTH, displayNameValidator } from "../../display-name";

@Injectable({
  providedIn: "root"
})
export class UserService extends FirestoreStorage<LAHUser> {

  /** True while the display name popup is open, so a second one does not open on top of it. */
  updatingUserName = false;

  public user$ = combineLatest([
    this.auth.uid$,
    this.auth.isAnonymous$
  ]).pipe(
    // A guest who registers keeps the same uid, and the register popup saves the name typed there.
    scan((previous, [uid, anonymous]) => ({
      uid,
      anonymous,
      registeredInPlace: previous.uid === uid && previous.anonymous && !anonymous
    }), { uid: "", anonymous: false, registeredInPlace: false }),
    switchMap(({ uid, anonymous, registeredInPlace }) => {
      return this.getOne(uid).pipe(
        switchMap(user => {
          // While an account is deleted its users document disappears before the auth account
          // does; asking for a display name then would open a popup that cannot be closed.
          if (!anonymous && !user.name && !registeredInPlace && !FirestoreStorage.writesArePaused()) {
            this.updateUserName(user, false).subscribe({
              error: (error: unknown) => console.error("Could not save the display name:", error)
            });
          }
          return of(user);
        })
      );
    }),
    shareReplay(1)
  );

  /**
   * Asks for a display name, starting from the current one, and saves it.
   *
   * Emits the saved name once it is written. Nothing is saved, and nothing is emitted, when the popup
   * is closed with Escape or Cancel or when no visible name is left after cleaning. The modal opens
   * at once; subscribe to save the answer.
   *
   * Args:
   *   user: the users document to update.
   *   cancellable: shows a Cancel button (the menu path); the automatic prompt has none.
   */
  public updateUserName(user: LAHUser, cancellable = true): Observable<string> {
    if (this.updatingUserName) {
      return EMPTY;
    }
    this.updatingUserName = true;
    const modalRef = this.modal.create({
      nzTitle: "Change your display name",
      nzContent: TextQuestionPopupComponent,
      nzData: {
        baseText: user.name ?? "",
        placeholder: "Display name",
        description: "Shown in the header next to the account menu.",
        type: "input",
        maxLength: DISPLAY_NAME_MAX_LENGTH,
        autocomplete: "nickname",
        cancellable,
        selectOnOpen: true,
        validator: displayNameValidator
      },
      nzFooter: null,
      nzClosable: false,
      nzMaskClosable: false
    });
    modalRef.afterClose.subscribe(() => this.updatingUserName = false);
    return modalRef.afterClose.pipe(
      take(1),
      map(answer => cleanDisplayName(answer)),
      filter(name => name.length > 0),
      switchMap(name => this.setOne(user.$key, { name }).pipe(map(() => name)))
    );
  }

  constructor(@Inject(FIRESTORE) firestore: Firestore, private auth: AuthService,
              private modal: NzModalService) {
    super(firestore);
  }

  protected getCollectionName(): string {
    return "users";
  }
}

import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { LAHUser } from "../../../model/lah-user";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { AuthService } from "./auth.service";
import { combineLatest, Observable, of, scan, shareReplay, switchMap } from "rxjs";
import { TextQuestionPopupComponent } from "../../../components/text-question-popup/text-question-popup/text-question-popup.component";
import { NzModalService } from "ng-zorro-antd/modal";

@Injectable({
  providedIn: "root"
})
export class UserService extends FirestoreStorage<LAHUser> {

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
          // does; asking for a user name then would open a popup that cannot be closed.
          if (!anonymous && !user.name && !registeredInPlace && !FirestoreStorage.writesArePaused()) {
            this.updateUserName(user);
          }
          return of(user);
        })
      );
    }),
    shareReplay(1)
  );

  public updateUserName(user: LAHUser): Observable<void> {
    this.updatingUserName = true;
    return this.modal.create({
      nzTitle: "Change your user name",
      nzContent: TextQuestionPopupComponent,
      nzData: {
        placeholder: "Username",
        type: "input"
      },
      nzFooter: null,
      nzClosable: false,
      nzMaskClosable: false
    })
      .afterClose
      .pipe(
        switchMap((name: string) => {
          this.updatingUserName = false;
          return this.setOne(user.$key, { name });
        })
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

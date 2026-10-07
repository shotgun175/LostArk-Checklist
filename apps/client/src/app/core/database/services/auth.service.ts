import { Inject, Injectable } from "@angular/core";
import { catchError, filter, first } from "rxjs/operators";
import { EMPTY, from, map, mapTo, Observable, shareReplay, switchMap } from "rxjs";
import { Auth, EmailAuthProvider, linkWithCredential, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, signOut, UserCredential } from "firebase/auth";
import { FIREBASE_AUTH } from "../../firebase/firebase.providers";
import { authState$ } from "../../firebase/rx";
import { NzMessageService } from "ng-zorro-antd/message";

@Injectable({
  providedIn: "root"
})
export class AuthService {

  private authState$ = authState$(this.auth);

  public uid$ = this.authState$.pipe(
    filter(Boolean),
    map(state => state.uid),
    filter(Boolean),
    shareReplay(1)
  );

  public isAnonymous$ = this.authState$.pipe(
    filter(Boolean),
    map(state => state.isAnonymous),
    shareReplay(1)
  );

  constructor(@Inject(FIREBASE_AUTH) private auth: Auth, private message: NzMessageService) {
    this.authState$.subscribe((state) => {
      if (!state) {
        signInAnonymously(auth);
      }
    });
  }

  public register(email: string, password: string): Observable<UserCredential> {
    return this.authState$.pipe(
      filter(Boolean),
      first(),
      switchMap((user) => {
        return from(linkWithCredential(user, EmailAuthProvider.credential(email, password)));
      }),
      catchError((err) => {
        this.message.error(err);
        return EMPTY;
      })
    );
  }

  public login(email: string, password: string): Observable<void> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      catchError((err) => {
        this.message.error(err);
        return EMPTY;
      }),
      mapTo(void 0)
    );
  }


  disconnect(): void {
    signOut(this.auth);
  }

  sendResetPassword(email: string): void {
    sendPasswordResetEmail(this.auth, email);
  }
}

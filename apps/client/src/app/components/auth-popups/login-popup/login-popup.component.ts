import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { AuthService } from "../../../core/database/services/auth.service";
import { RosterService } from "../../../core/database/services/roster.service";
import { DataTransferService } from "../../../core/import/data-transfer.service";
import { NzModalRef } from "ng-zorro-antd/modal";
import { NzMessageService } from "ng-zorro-antd/message";
import { combineLatest, finalize, map } from "rxjs";
import { AuthPopupSwitch } from "../auth-popups.service";

@Component({
  selector: "lostark-helper-login-popup",
  templateUrl: "./login-popup.component.html",
  styleUrls: ["./login-popup.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LoginPopupComponent {
  /** True while signing in, so a second click cannot send it again. */
  public busy = signal(false);

  public backupBusy = signal(false);

  public form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(6)]]
  });

  /** Characters a guest has on this browser, which this browser stops showing after signing in to another account. */
  public guestCharacterCount$ = combineLatest([this.auth.isAnonymous$, this.rosterService.roster$]).pipe(
    map(([anonymous, roster]) => anonymous ? roster.characters.length : 0)
  );

  constructor(private fb: UntypedFormBuilder, private auth: AuthService,
              private modalRef: NzModalRef<LoginPopupComponent, AuthPopupSwitch | undefined>,
              private rosterService: RosterService, private dataTransfer: DataTransferService,
              private message: NzMessageService) {
  }

  public async sendResetPassword(): Promise<void> {
    await this.auth.sendResetPassword(this.form.getRawValue().email ?? "");
    this.modalRef.close();
  }

  public switchToRegister(): void {
    this.modalRef.close("register");
  }

  public downloadBackup(): void {
    this.backupBusy.set(true);
    this.dataTransfer.downloadBackup().then(() => {
      this.backupBusy.set(false);
    }, (error: Error) => {
      this.backupBusy.set(false);
      console.error(error);
      this.message.error(`Backup failed: ${error.message}`);
    });
  }

  login(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const creds = this.form.getRawValue();
    this.auth.login(creds.email, creds.password)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe(() => {
        this.message.success("Signed in.");
        this.modalRef.close();
      });
  }
}

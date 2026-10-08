import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { AuthService } from "../../../core/database/services/auth.service";
import { NzModalRef } from "ng-zorro-antd/modal";
import { finalize } from "rxjs";

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

  public form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(6)]]
  });

  constructor(private fb: UntypedFormBuilder, private auth: AuthService,
              private modalRef: NzModalRef) {
  }

  public async sendResetPassword(): Promise<void> {
    await this.auth.sendResetPassword(this.form.getRawValue().email ?? "");
    this.modalRef.close();
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
        this.modalRef.close();
      });
  }
}

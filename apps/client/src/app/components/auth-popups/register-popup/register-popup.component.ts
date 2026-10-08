import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { AbstractControl, UntypedFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { AuthService } from "../../../core/database/services/auth.service";
import { NzModalRef } from "ng-zorro-antd/modal";
import { finalize, switchMap } from "rxjs";
import { UserService } from "../../../core/database/services/user.service";

@Component({
  selector: "lostark-helper-register-popup",
  templateUrl: "./register-popup.component.html",
  styleUrls: ["./register-popup.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class RegisterPopupComponent {
  /** True while the account is being created, so a second click cannot send it again. */
  public busy = signal(false);

  public form = this.fb.group({
    username: ["", [Validators.required]],
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(6)]],
    confirmPassword: ["", [Validators.required, Validators.minLength(6)]]
  }, {
    validators: [this.matchPasswords]
  });

  constructor(private fb: UntypedFormBuilder, private auth: AuthService,
              private modalRef: NzModalRef, private userService: UserService) {
  }

  private matchPasswords(AC: AbstractControl): ValidationErrors | null {
    const password = AC.get("password")?.value;
    const confirmPassword = AC.get("confirmPassword")?.value;
    if (password !== confirmPassword) {
      return { matchPassword: true };
    } else {
      return null;
    }
  }

  submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const creds = this.form.getRawValue();
    this.auth.register(creds.email, creds.password)
      .pipe(
        switchMap((res) => {
          return this.userService.setOne(res.user.uid, { name: creds.username });
        }),
        finalize(() => this.busy.set(false))
      )
      .subscribe(() => {
        this.modalRef.close();
      });
  }
}

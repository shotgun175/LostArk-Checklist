import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { AbstractControl, UntypedFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { AuthService } from "../../../core/database/services/auth.service";
import { NzModalRef } from "ng-zorro-antd/modal";
import { NzMessageService } from "ng-zorro-antd/message";
import { finalize, switchMap } from "rxjs";
import { UserService } from "../../../core/database/services/user.service";
import { cleanDisplayName, DISPLAY_NAME_MAX_LENGTH, emailDisplayName } from "../../../core/display-name";
import { AuthPopupSwitch } from "../auth-popups.service";

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

  public readonly displayNameMaxLength = DISPLAY_NAME_MAX_LENGTH;

  public form = this.fb.group({
    displayName: ["", [Validators.maxLength(DISPLAY_NAME_MAX_LENGTH)]],
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(6)]],
    confirmPassword: ["", [Validators.required, Validators.minLength(6)]]
  }, {
    validators: [this.matchPasswords]
  });

  constructor(private fb: UntypedFormBuilder, private auth: AuthService,
              private modalRef: NzModalRef<RegisterPopupComponent, AuthPopupSwitch | undefined>,
              private userService: UserService, private message: NzMessageService) {
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

  /** "Passwords do not match" waits until something was typed in Confirmation. */
  public get showPasswordMismatch(): boolean {
    const confirm = this.form.get("confirmPassword");
    return !!this.form.errors?.["matchPassword"] && !!confirm?.dirty && !!confirm.value;
  }

  public switchToSignIn(): void {
    this.modalRef.close("sign-in");
  }

  submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const creds = this.form.getRawValue();
    // The display name is optional: a blank one becomes the part of the email before the @.
    const name = cleanDisplayName(creds.displayName) || emailDisplayName(creds.email);
    this.auth.register(creds.email, creds.password)
      .pipe(
        switchMap((res) => {
          return this.userService.setOne(res.user.uid, { name });
        }),
        finalize(() => this.busy.set(false))
      )
      .subscribe(() => {
        this.message.success("Account created. Your checklist is now saved to your account.");
        this.modalRef.close();
      });
  }
}

import { Injectable } from "@angular/core";
import { NzModalService } from "ng-zorro-antd/modal";
import { LoginPopupComponent } from "./login-popup/login-popup.component";
import { RegisterPopupComponent } from "./register-popup/register-popup.component";

/** What a popup closes with to open the other one instead. */
export type AuthPopupSwitch = "sign-in" | "register";

/**
 * Opens the Sign in and Create an account popups. Each popup links to the other: it closes with
 * an AuthPopupSwitch value and this service opens the other one, so the popups do not import each other.
 */
@Injectable({
  providedIn: "root"
})
export class AuthPopupsService {

  constructor(private modal: NzModalService) {
  }

  openSignIn(): void {
    this.modal.create<LoginPopupComponent, unknown, AuthPopupSwitch | undefined>({
      nzTitle: "Sign in",
      nzContent: LoginPopupComponent,
      nzMaskClosable: false,
      nzFooter: null
    }).afterClose.subscribe(next => this.switchTo(next));
  }

  openRegister(): void {
    this.modal.create<RegisterPopupComponent, unknown, AuthPopupSwitch | undefined>({
      nzTitle: "Create an account",
      nzContent: RegisterPopupComponent,
      nzMaskClosable: false,
      nzFooter: null
    }).afterClose.subscribe(next => this.switchTo(next));
  }

  private switchTo(next: AuthPopupSwitch | undefined): void {
    if (next === "sign-in") {
      this.openSignIn();
    } else if (next === "register") {
      this.openRegister();
    }
  }
}

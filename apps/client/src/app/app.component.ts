import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { AuthService } from "./core/database/services/auth.service";
import { UserService } from "./core/database/services/user.service";
import { LayoutStateService } from "./core/services/layout-state.service";
import { NzModalService } from "ng-zorro-antd/modal";
import { RegisterPopupComponent } from "./components/auth-popups/register-popup/register-popup.component";
import { LoginPopupComponent } from "./components/auth-popups/login-popup/login-popup.component";
import { NzMessageService } from "ng-zorro-antd/message";
import { LAHUser } from "./model/lah-user";

const GUEST_BANNER_DISMISSED = "guest-banner:dismissed";

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

@Component({
  selector: "lostark-helper-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AppComponent {
  isCollapsed = localStorage.getItem("sidebar:collapsed") === "true";

  public user$ = this.userService.user$;

  public anonymous$ = this.auth.isAnonymous$;

  public readonly guestBannerDismissed = signal(readSessionFlag(GUEST_BANNER_DISMISSED));

  public readonly guestBannerText = "You are using a guest account on this browser. Register to keep your checklist safe and use it on other devices.";

  constructor(private layoutState: LayoutStateService,
              private userService: UserService,
              private auth: AuthService,
              private modalService: NzModalService,
              private message: NzMessageService
  ) {
  }

  saveCollapsed(collapsed: boolean): void {
    this.layoutState.setSidebarCollapsed(collapsed);
  }

  signIn(): void {
    this.modalService.create({
      nzContent: LoginPopupComponent,
      nzMaskClosable: false,
      nzFooter: null
    });
  }

  register(): void {
    this.modalService.create({
      nzContent: RegisterPopupComponent,
      nzMaskClosable: false,
      nzFooter: null
    });
  }

  dismissGuestBanner(): void {
    this.guestBannerDismissed.set(true);
    try {
      sessionStorage.setItem(GUEST_BANNER_DISMISSED, "true");
    } catch {
      // Storage blocked: the banner stays closed until the page reloads.
    }
  }

  disconnect(): void {
    this.auth.disconnect();
  }

  updateUserName(user: LAHUser): void {
    this.userService.updateUserName(user).subscribe(() => {
      this.message.success("Username updated");
    });
  }
}

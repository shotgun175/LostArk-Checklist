import { Component } from "@angular/core";
import { AuthService } from "./core/database/services/auth.service";
import { UserService } from "./core/database/services/user.service";
import { LayoutStateService } from "./core/services/layout-state.service";
import { NzModalService } from "ng-zorro-antd/modal";
import { RegisterPopupComponent } from "./components/auth-popups/register-popup/register-popup.component";
import { LoginPopupComponent } from "./components/auth-popups/login-popup/login-popup.component";
import { NzMessageService } from "ng-zorro-antd/message";
import { LAHUser } from "./model/lah-user";

@Component({
  selector: "lostark-helper-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.less"]
})
export class AppComponent {
  isCollapsed = localStorage.getItem("sidebar:collapsed") === "true";

  public user$ = this.userService.user$;

  public anonymous$ = this.auth.isAnonymous$;

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

  disconnect(): void {
    this.auth.disconnect();
  }

  updateUserName(user: LAHUser): void {
    this.userService.updateUserName(user).subscribe(() => {
      this.message.success("Username updated");
    });
  }
}

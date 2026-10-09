import { Component, ChangeDetectionStrategy, ElementRef, signal, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { pairwise } from "rxjs";
import { NzContentComponent } from "ng-zorro-antd/layout";
import { AuthService } from "./core/database/services/auth.service";
import { UserService } from "./core/database/services/user.service";
import { LayoutStateService } from "./core/services/layout-state.service";
import { AuthPopupsService } from "./components/auth-popups/auth-popups.service";
import { DataTransferService } from "./core/import/data-transfer.service";
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
  /** Below the md breakpoint the sidebar is hidden and opens over the page from the header's menu button. */
  public readonly isPhone = signal(this.layoutState.isPhone);

  isCollapsed = this.layoutState.sidebarCollapsedForScreen();

  public user$ = this.userService.user$;

  public anonymous$ = this.auth.isAnonymous$;

  public readonly guestBannerDismissed = signal(readSessionFlag(GUEST_BANNER_DISMISSED));

  public readonly guestBannerText = "You are using a guest account on this browser. Register to keep your checklist safe and use it on other devices.";

  /** The page's scroll container, scrolled back to the top when another page opens. */
  @ViewChild(NzContentComponent, { read: ElementRef }) private content?: ElementRef<HTMLElement>;

  constructor(private layoutState: LayoutStateService,
              private userService: UserService,
              private auth: AuthService,
              private authPopups: AuthPopupsService,
              private message: NzMessageService,
              router: Router,
              dataTransfer: DataTransferService
  ) {
    // An import or restore in another tab of this account replaces the data this tab shows.
    dataTransfer.reloadWhenReplacedInAnotherTab();
    this.layoutState.isPhone$.pipe(takeUntilDestroyed()).subscribe(phone => {
      this.isPhone.set(phone);
      this.isCollapsed = this.layoutState.sidebarCollapsedForScreen();
    });
    // A new page starts at the top. Back and Forward (popstate) keep the browser's own position.
    let trigger: NavigationStart["navigationTrigger"];
    router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        trigger = event.navigationTrigger;
      } else if (event instanceof NavigationEnd && trigger !== "popstate" && this.content) {
        this.content.nativeElement.scrollTop = 0;
      }
    });
    // A closed guest banner stays closed only for the guest who closed it: after Log out, Sign in or
    // an account deletion, the next guest in this tab sees it again.
    this.auth.uid$.pipe(pairwise(), takeUntilDestroyed()).subscribe(([previous, current]) => {
      if (previous !== current) {
        this.guestBannerDismissed.set(false);
        try {
          sessionStorage.removeItem(GUEST_BANNER_DISMISSED);
        } catch {
          // Storage blocked: nothing was saved.
        }
      }
    });
  }

  saveCollapsed(collapsed: boolean): void {
    this.layoutState.setSidebarCollapsed(collapsed);
  }

  openSider(): void {
    this.isCollapsed = false;
  }

  /** On a phone the sidebar closes after a tap on a page link or outside it. */
  closeSiderOnPhone(): void {
    if (this.isPhone()) {
      this.isCollapsed = true;
    }
  }

  /** The opened user menu moves focus to its first item, and focus goes back to the menu button when it closes. */
  onUserMenuVisibleChange(visible: boolean, button: HTMLButtonElement): void {
    if (visible) {
      requestAnimationFrame(() => this.userMenuItems()[0]?.focus());
    } else if (!document.activeElement || document.activeElement === document.body || document.activeElement.closest(".user-menu-overlay")) {
      button.focus();
    }
  }

  /** Arrow keys move between the user menu items, Enter or Space picks one. */
  onUserMenuKeydown(event: KeyboardEvent): void {
    const items = this.userMenuItems();
    const index = items.indexOf(event.currentTarget as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      (event.currentTarget as HTMLElement).click();
    }
  }

  private userMenuItems(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".user-menu-overlay li.menu-item"));
  }

  signIn(): void {
    this.authPopups.openSignIn();
  }

  register(): void {
    this.authPopups.openRegister();
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
    this.message.success("Logged out. This browser now starts a new, empty guest checklist; sign in to see your account's checklist again.", { nzDuration: 6000 });
  }

  updateUserName(user: LAHUser): void {
    this.userService.updateUserName(user).subscribe({
      next: () => this.message.success("Display name updated"),
      error: (error: unknown) => {
        console.error(error);
        this.message.error("Could not save the display name. Please try again.");
      }
    });
  }
}

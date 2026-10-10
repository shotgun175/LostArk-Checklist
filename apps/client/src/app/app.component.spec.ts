import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { BehaviorSubject, NEVER, Observable, of } from "rxjs";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropdownModule } from "ng-zorro-antd/dropdown";
import { NzMessageService } from "ng-zorro-antd/message";
import { AppComponent } from "./app.component";
import { AuthService } from "./core/database/services/auth.service";
import { UserService } from "./core/database/services/user.service";
import { AuthPopupsService } from "./components/auth-popups/auth-popups.service";
import { DataTransferService } from "./core/import/data-transfer.service";
import { AppUpdateService } from "./core/services/app-update.service";
import { LAHUser } from "./model/lah-user";

jest.mock("./core/database/services/auth.service", () => ({ AuthService: class {} }));
jest.mock("./core/database/services/user.service", () => ({ UserService: class {} }));
jest.mock("./components/auth-popups/auth-popups.service", () => ({ AuthPopupsService: class {} }));
jest.mock("./core/import/data-transfer.service", () => ({ DataTransferService: class {} }));
jest.mock("./core/services/app-update.service", () => ({ AppUpdateService: class {} }));

describe("AppComponent", () => {
  let fixture: ComponentFixture<AppComponent>;
  let updateReady: ReturnType<typeof signal<boolean>>;
  let appUpdate: { updateReady: ReturnType<typeof signal<boolean>>; reload: jest.Mock };
  let onLine: jest.SpyInstance;

  function render(options: { anonymous: boolean; user$: Observable<LAHUser> }): HTMLElement {
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [NzAlertModule, NzButtonModule, NzDropdownModule],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAnonymous$: new BehaviorSubject(options.anonymous), uid$: of("uid") } },
        { provide: UserService, useValue: { user$: options.user$ } },
        { provide: AuthPopupsService, useValue: {} },
        { provide: DataTransferService, useValue: { reloadWhenReplacedInAnotherTab: jest.fn() } },
        { provide: AppUpdateService, useValue: appUpdate },
        { provide: NzMessageService, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: HTMLElement, selector: string): string | undefined {
    return element.querySelector(selector)?.textContent?.trim();
  }

  beforeEach(() => {
    sessionStorage.clear();
    updateReady = signal(false);
    appUpdate = { updateReady, reload: jest.fn(() => Promise.resolve()) };
    onLine = jest.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  afterEach(() => {
    onLine.mockRestore();
    TestBed.resetTestingModule();
  });

  it("shows Guest from the sign-in state even when the users document is not loaded (offline)", () => {
    const element = render({ anonymous: true, user$: NEVER });
    expect(text(element, ".user-menu .user-name")).toBe("Guest");
  });

  it("shows the display name of a registered user from the users document", () => {
    const element = render({ anonymous: false, user$: of({ name: "Bard Main" } as LAHUser) });
    expect(text(element, ".user-menu .user-name")).toBe("Bard Main");
  });

  it("shows no name for a registered user until the users document arrives", () => {
    const element = render({ anonymous: false, user$: NEVER });
    expect(element.querySelector(".user-menu .user-name")).toBeNull();
  });

  it("shows the new version banner when an update is ready, and Reload reloads", () => {
    const element = render({ anonymous: false, user$: NEVER });
    expect(element.querySelector(".update-banner")).toBeNull();
    updateReady.set(true);
    fixture.detectChanges();
    expect(text(element, ".update-banner .ant-alert-message")).toBe("A new version is available.");
    const button = element.querySelector<HTMLButtonElement>(".update-banner button");
    expect(button?.textContent?.trim()).toBe("Reload");
    button?.click();
    expect(appUpdate.reload).toHaveBeenCalledTimes(1);
  });

  it("shows the offline banner while the browser is offline", () => {
    const element = render({ anonymous: false, user$: NEVER });
    expect(element.querySelector(".offline-banner")).toBeNull();
    window.dispatchEvent(new Event("offline"));
    fixture.detectChanges();
    expect(text(element, ".offline-banner .ant-alert-message"))
      .toBe("You're offline. Your ticks are saved on this device and sync when you're back online.");
    window.dispatchEvent(new Event("online"));
    fixture.detectChanges();
    expect(element.querySelector(".offline-banner")).toBeNull();
  });

  it("starts with the offline banner when the page opens offline", () => {
    onLine.mockReturnValue(false);
    const element = render({ anonymous: false, user$: NEVER });
    expect(element.querySelector(".offline-banner")).not.toBeNull();
  });

  it("puts the update and offline banners above the guest banner", () => {
    updateReady.set(true);
    onLine.mockReturnValue(false);
    const element = render({ anonymous: true, user$: NEVER });
    const banners = Array.from(element.querySelectorAll(".app-banner")).map(banner => banner.classList[1]);
    expect(banners).toEqual(["update-banner", "offline-banner", "guest-banner"]);
  });
});

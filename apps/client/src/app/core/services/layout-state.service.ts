import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable } from "rxjs";
import { LocalStorageBehaviorSubject } from "../local-storage-behavior-subject";

/** Below ng-zorro's md breakpoint (768px) the sidebar is hidden and opens over the page. */
export const PHONE_MEDIA_QUERY = "(max-width: 767.98px)";

// nz-sider widths: nzWidth 200, nzCollapsedWidth 80 (0 on a phone, where it opens over the page)
const SIDEBAR_WIDTH_OPEN = 200;
const SIDEBAR_WIDTH_COLLAPSED = 80;

@Injectable({
  providedIn: "root"
})
export class LayoutStateService {
  private readonly sidebarCollapsed = new LocalStorageBehaviorSubject<boolean>("sidebar:collapsed", false);

  /** The saved collapse choice. It applies from the md breakpoint up; a phone does not change it. */
  public readonly sidebarCollapsed$: Observable<boolean> = this.sidebarCollapsed.asObservable();

  private readonly phoneQuery: MediaQueryList | null = typeof window.matchMedia === "function" ? window.matchMedia(PHONE_MEDIA_QUERY) : null;

  private readonly phone = new BehaviorSubject<boolean>(this.phoneQuery?.matches ?? false);

  /** True below the md breakpoint. */
  public readonly isPhone$: Observable<boolean> = this.phone.pipe(distinctUntilChanged());

  /** Width the sidebar takes from the page: 0 on a phone, where it opens over the page. */
  public readonly sidebarWidth$: Observable<number> = combineLatest([this.sidebarCollapsed$, this.isPhone$]).pipe(
    map(([collapsed, phone]) => phone ? 0 : collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN)
  );

  public readonly showHiddenCharacters$ = new LocalStorageBehaviorSubject<boolean>("characters:show-hidden", false);

  constructor() {
    this.phoneQuery?.addEventListener("change", event => this.phone.next(event.matches));
  }

  get isPhone(): boolean {
    return this.phone.value;
  }

  /** Collapse state to show: always collapsed (hidden) on a phone, the saved choice from md up. */
  sidebarCollapsedForScreen(): boolean {
    return this.isPhone || this.sidebarCollapsed.value;
  }

  /** Saves the collapse choice, except on a phone, where opening and closing the sidebar is not a choice to keep. */
  setSidebarCollapsed(collapsed: boolean): void {
    if (!this.isPhone) {
      this.sidebarCollapsed.next(collapsed);
    }
  }
}

import { firstValueFrom } from "rxjs";
import { LayoutStateService, PHONE_MEDIA_QUERY } from "./layout-state.service";

/** A matchMedia stand-in for the phone query; `change` fires a breakpoint crossing. */
function mockPhoneQuery(matches: boolean): { change(matches: boolean): void } {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const query = {
    matches,
    media: PHONE_MEDIA_QUERY,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener)
  };
  window.matchMedia = jest.fn(() => query) as unknown as typeof window.matchMedia;
  return {
    change(next: boolean) {
      query.matches = next;
      listeners.forEach(listener => listener({ matches: next }));
    }
  };
}

describe("LayoutStateService", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("starts with the sidebar open when nothing is stored", async () => {
    const service = new LayoutStateService();
    expect(await firstValueFrom(service.sidebarCollapsed$)).toBe(false);
  });

  it("reads the stored collapsed state on creation", async () => {
    localStorage.setItem("sidebar:collapsed", "true");
    const service = new LayoutStateService();
    expect(await firstValueFrom(service.sidebarCollapsed$)).toBe(true);
  });

  it("emits and persists every new collapsed state", () => {
    const service = new LayoutStateService();
    const seen: boolean[] = [];
    const subscription = service.sidebarCollapsed$.subscribe(collapsed => seen.push(collapsed));
    service.setSidebarCollapsed(true);
    expect(localStorage.getItem("sidebar:collapsed")).toBe("true");
    service.setSidebarCollapsed(false);
    expect(localStorage.getItem("sidebar:collapsed")).toBe("false");
    subscription.unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it("defaults showHiddenCharacters$ to false", () => {
    const service = new LayoutStateService();
    expect(service.showHiddenCharacters$.value).toBe(false);
  });

  it("persists showHiddenCharacters$ under characters:show-hidden", () => {
    const service = new LayoutStateService();
    service.showHiddenCharacters$.next(true);
    expect(localStorage.getItem("characters:show-hidden")).toBe("true");
    expect(new LayoutStateService().showHiddenCharacters$.value).toBe(true);
  });

  describe("breakpoint", () => {
    it("shows the saved collapse choice from md up", () => {
      mockPhoneQuery(false);
      localStorage.setItem("sidebar:collapsed", "true");
      expect(new LayoutStateService().sidebarCollapsedForScreen()).toBe(true);
      localStorage.setItem("sidebar:collapsed", "false");
      expect(new LayoutStateService().sidebarCollapsedForScreen()).toBe(false);
    });

    it("starts with the sidebar hidden on a phone, whatever was saved", () => {
      mockPhoneQuery(true);
      localStorage.setItem("sidebar:collapsed", "false");
      const service = new LayoutStateService();
      expect(service.isPhone).toBe(true);
      expect(service.sidebarCollapsedForScreen()).toBe(true);
    });

    it("does not save opening or closing the sidebar on a phone", () => {
      mockPhoneQuery(true);
      localStorage.setItem("sidebar:collapsed", "false");
      const service = new LayoutStateService();
      service.setSidebarCollapsed(true);
      expect(localStorage.getItem("sidebar:collapsed")).toBe("false");
    });

    it("gives the page the whole width on a phone and follows a breakpoint crossing", async () => {
      const query = mockPhoneQuery(false);
      localStorage.setItem("sidebar:collapsed", "true");
      const service = new LayoutStateService();
      expect(await firstValueFrom(service.sidebarWidth$)).toBe(80);
      query.change(true);
      expect(service.isPhone).toBe(true);
      expect(await firstValueFrom(service.sidebarWidth$)).toBe(0);
      query.change(false);
      service.setSidebarCollapsed(false);
      expect(await firstValueFrom(service.sidebarWidth$)).toBe(200);
    });
  });
});

import { firstValueFrom } from "rxjs";
import { LayoutStateService } from "./layout-state.service";

describe("LayoutStateService", () => {
  beforeEach(() => {
    localStorage.clear();
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
});

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { LocalStorageBehaviorSubject } from "../local-storage-behavior-subject";

@Injectable({
  providedIn: "root"
})
export class LayoutStateService {
  private readonly sidebarCollapsed = new LocalStorageBehaviorSubject<boolean>("sidebar:collapsed", false);

  public readonly sidebarCollapsed$: Observable<boolean> = this.sidebarCollapsed.asObservable();

  public readonly showHiddenCharacters$ = new LocalStorageBehaviorSubject<boolean>("characters:show-hidden", false);

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.next(collapsed);
  }
}

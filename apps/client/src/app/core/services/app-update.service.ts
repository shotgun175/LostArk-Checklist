import { ApplicationRef, DestroyRef, inject, Injectable, NgZone, signal } from "@angular/core";
import { SwUpdate } from "@angular/service-worker";
import { filter, first, race, timer } from "rxjs";
import { NzMessageService } from "ng-zorro-antd/message";
import { FirestoreStorage } from "../database/firestore-storage";

/** How often an open tab asks the server for a new version. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** How long the "must reload" message shows before a broken page reloads. */
export const UNRECOVERABLE_RELOAD_DELAY_MS = 3000;

/**
 * How long the six-hourly checks wait for the app to become stable before they start anyway, as
 * registerWhenStable:30000 does for the worker. The Checklist page never becomes stable (its reset
 * countdowns tick every second).
 */
export const STABLE_WAIT_MS = 30000;

/**
 * Tells the user when the service worker has a new version of the site ready, and reloads a page the
 * worker can no longer serve. Does nothing where the worker is off (nx serve, development builds, tests).
 */
@Injectable({
  providedIn: "root"
})
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);
  private readonly zone = inject(NgZone);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly ready = signal(false);

  /** True once a new version is downloaded and a reload would show it. */
  public readonly updateReady = this.ready.asReadonly();

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }
    const versions = this.swUpdate.versionUpdates.pipe(filter(event => event.type === "VERSION_READY")).subscribe(() => this.ready.set(true));
    // A file of the running version is gone from the server and from the cache: only a reload helps.
    const broken = this.swUpdate.unrecoverable.subscribe(event => {
      console.error("This version of the site can no longer load:", event.reason);
      this.message.error("This page is out of date and will reload.", { nzDuration: UNRECOVERABLE_RELOAD_DELAY_MS });
      // Ticks queued up to the reload are saved on this device first.
      setTimeout(() => FirestoreStorage.flushPendingLocally().then(() => this.reloadPage()), UNRECOVERABLE_RELOAD_DELAY_MS);
    });

    // Outside the zone, so the checks never keep the app from being stable and do not trigger change
    // detection.
    const onVisible = (): void => {
      if (document.visibilityState === "visible") {
        this.checkForUpdate();
      }
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    this.zone.runOutsideAngular(() => document.addEventListener("visibilitychange", onVisible));
    // The fallback timer is outside the zone too, or it would itself hold off stability for 30 s.
    const stable = this.zone.runOutsideAngular(() => race(this.appRef.isStable.pipe(first(Boolean)), timer(STABLE_WAIT_MS)).subscribe(() => {
      interval = setInterval(() => this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    }));

    this.destroyRef.onDestroy(() => {
      versions.unsubscribe();
      broken.unsubscribe();
      stable.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    });
  }

  /** Saves queued ticks on this device (they are sent from there), switches to the new version and reloads the page. */
  public async reload(): Promise<void> {
    await FirestoreStorage.flushPendingLocally();
    try {
      await this.swUpdate.activateUpdate();
    } catch (error) {
      // The reload still loads the newest version the worker has.
      console.error("Could not switch to the new version:", error);
    }
    this.reloadPage();
  }

  public reloadPage(): void {
    window.location.reload();
  }

  /** Offline the check fails; the next one runs when the tab is shown again or in six hours. */
  private checkForUpdate(): void {
    this.swUpdate.checkForUpdate().catch((error: unknown) => console.warn("Could not check for a new version:", error));
  }
}

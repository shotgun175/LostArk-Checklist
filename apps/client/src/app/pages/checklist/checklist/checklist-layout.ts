import { earnsGold } from "../../gold-planner/gold-task";
import { TaskFrequency } from "../../../model/task-frequency";

export interface ChecklistScroll {
  x?: string | null;
  y: string | null;
}

export interface ChecklistScrollInput {
  innerWidth: number;
  innerHeight: number;
  visibleCharacterCount: number;
  sidebarCollapsed: boolean;
  /** Width the sidebar takes from the page (0 on a phone, where it opens over the page); from sidebarCollapsed when not given. */
  sidebarWidth?: number;
  /** Measured table body height (see checklistBodyHeight); null until the table has rendered. */
  bodyHeight?: number | null;
}

// nz-sider default widths (nzWidth 200, nzCollapsedWidth 80)
export const SIDEBAR_WIDTH_COLLAPSED = 80;
export const SIDEBAR_WIDTH_OPEN = 200;

export const TASK_COLUMN_WIDTH_COLLAPSED = 180;
export const TASK_COLUMN_WIDTH_OPEN = 130;
// Under 576px the labels wrap to 2 lines in a narrower column
export const TASK_COLUMN_WIDTH_PHONE = 110;
// With few characters the task column takes free space, up to this width
export const TASK_COLUMN_WIDTH_MAX = 240;
const PHONE_MAX_WIDTH = 575;

// Character column width: the td min-width in checklist.component.less (115px).
// At max-width 992px the min-width is 76px, which holds the counter and its reset button.
const CHARACTER_COLUMN_WIDTH = 115;
const CHARACTER_COLUMN_WIDTH_NARROW = 76;
const NARROW_MAX_WIDTH = 992;
// Page padding on the checklist (2 x 12), the bordered table's left border (1), the table body's
// vertical scrollbar (15) and the page's own vertical scrollbar (15), which shows on short windows
const TABLE_BODY_CHROME = 24 + 1 + 15 + 15;
// Smallest table body height, so a short window still shows a few rows and scrolls the page instead
export const MIN_BODY_HEIGHT = 300;

function characterColumnWidth(innerWidth: number): number {
  return innerWidth <= NARROW_MAX_WIDTH ? CHARACTER_COLUMN_WIDTH_NARROW : CHARACTER_COLUMN_WIDTH;
}

function availableTableWidth(input: ChecklistScrollInput): number {
  const sidebarWidth = input.sidebarWidth ?? (input.sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN);
  return input.innerWidth - sidebarWidth - TABLE_BODY_CHROME;
}

/**
 * Task column width: 130px with the sidebar open, 180px collapsed and 110px on a phone.
 * When the character columns leave free space, the column grows into it (up to 240px),
 * so fewer task labels wrap. It never takes space the character columns need.
 */
export function checklistTaskColumnWidth(input: ChecklistScrollInput): number {
  if (input.innerWidth <= PHONE_MAX_WIDTH) {
    return TASK_COLUMN_WIDTH_PHONE;
  }
  const base = input.sidebarCollapsed ? TASK_COLUMN_WIDTH_COLLAPSED : TASK_COLUMN_WIDTH_OPEN;
  const free = availableTableWidth(input) - base - characterColumnWidth(input.innerWidth) * input.visibleCharacterCount;
  return free > 0 ? Math.min(base + free, Math.max(base, TASK_COLUMN_WIDTH_MAX)) : base;
}

/**
 * nz-table scroll settings for the checklist.
 *
 * y keeps the table body inside the window: the measured body height once the table
 * has rendered, a rough guess before that. x is only set when the task column plus
 * the visible character columns are wider than the table body. It is then the table's
 * own width, so the body scrolls sideways and the header follows. Without x the body
 * clips sideways overflow (overflow-x: hidden), which also hides a 1px rounding
 * overflow the table has even when everything fits.
 */
export function computeChecklistScroll(input: ChecklistScrollInput): ChecklistScroll {
  const y = input.bodyHeight ?? input.innerHeight - 400;
  const scrolling: ChecklistScroll = { y: `${y}px` };
  const tableWidth = checklistTaskColumnWidth(input) + characterColumnWidth(input.innerWidth) * input.visibleCharacterCount;
  if (tableWidth > availableTableWidth(input)) {
    scrolling.x = `${tableWidth}px`;
  }
  return scrolling;
}

export interface ChecklistBodyMetrics {
  /** Visible height of the page's scroll container (nz-content). */
  viewportHeight: number;
  /** Top of the table body, measured from the top of the scrolled content (not the window). */
  bodyTop: number;
  /** Everything under the table body: the table's bottom border, the page padding and the footer. */
  belowBody: number;
}

/**
 * Table body height that ends the page exactly at the bottom of the window, so the page
 * itself does not scroll and the body's sideways scrollbar stays in view.
 */
export function checklistBodyHeight(metrics: ChecklistBodyMetrics): number {
  return Math.max(MIN_BODY_HEIGHT, Math.floor(metrics.viewportHeight - metrics.bodyTop - metrics.belowBody));
}

/** Countdown text: HH:mm:ss, with a day count in front when more than 24 hours are left (5d 14:09:23). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds % 86400 / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const time = [hours, minutes, seconds].map(n => n.toString().padStart(2, '0')).join(':');
  return days > 0 ? `${days}d ${time}` : time;
}

const MODE_NAMES: Record<string, string> = {
  NM: 'Normal Mode',
  HM: 'Hard Mode',
  NiM: 'Nightmare Mode',
  Solo: 'Solo Mode',
  Mix: 'Mixed modes'
};

/** Tooltip of the checklist gold badge, for example "Normal Mode, earns gold". */
export function goldBadgeTooltip(modeBadge: string, coin: boolean): string {
  const mode = modeBadge ? MODE_NAMES[modeBadge] || modeBadge : '';
  if (!mode) {
    return coin ? 'Earns gold' : '';
  }
  return coin ? `${mode}, earns gold` : `${mode}, no gold`;
}

/** Short mode label for the checklist gold badge; empty when no mode is set. */
export function formatModeBadge(runningMode: string | undefined): string {
  switch (runningMode) {
    case undefined:
    case '':
      return '';
    case 'Nightmare':
    case 'NiM':
      return 'NiM';
    case 'Mixed':
      return 'Mix';
    default:
      return runningMode;
  }
}

/**
 * The checklist corner badge of a raid cell: shown when a mode is set for the raid (any character)
 * or the raid earns gold; the gold coin only when it earns gold (Taking Gold on a weekly gold character).
 */
export function getGoldBadge(modeBadge: string, takingGold: boolean | undefined, weeklyGold: boolean | undefined): { show: boolean, coin: boolean } {
  const coin = earnsGold(takingGold, weeklyGold);
  return { show: !!modeBadge || coin, coin };
}

/** Weekly and bi-weekly (including the Thaemine offset) rows share the weekly tint. */
export function isWeeklyFrequency(frequency: TaskFrequency): boolean {
  return frequency === TaskFrequency.WEEKLY || frequency === TaskFrequency.BIWEEKLY || frequency === TaskFrequency.BIWEEKLY_OFFSET;
}

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
}

// nz-sider default widths (nzWidth 200, nzCollapsedWidth 80)
export const SIDEBAR_WIDTH_COLLAPSED = 80;
export const SIDEBAR_WIDTH_OPEN = 200;

export const TASK_COLUMN_WIDTH_COLLAPSED = 180;
export const TASK_COLUMN_WIDTH_OPEN = 130;

export function checklistTaskColumnWidth(sidebarCollapsed: boolean): number {
  return sidebarCollapsed ? TASK_COLUMN_WIDTH_COLLAPSED : TASK_COLUMN_WIDTH_OPEN;
}

// Character column width: the td min-width in checklist.component.less (115px).
// At max-width 992px the min-width is 60px, but the task counters make the columns 66px.
const CHARACTER_COLUMN_WIDTH = 115;
const CHARACTER_COLUMN_WIDTH_NARROW = 66;
const NARROW_MAX_WIDTH = 992;
// Page padding (48), the bordered table's left border (1), the table body's vertical
// scrollbar (15) and the page's own vertical scrollbar (15), which shows on short windows
const TABLE_BODY_CHROME = 48 + 1 + 15 + 15;

/**
 * nz-table scroll settings for the checklist.
 *
 * y keeps the table body inside the window. x is only set when the task column
 * plus the visible character columns are wider than the table body. It is then
 * the table's own width, so the body scrolls sideways and the header follows.
 * Without x the body clips sideways overflow (overflow-x: hidden), which also
 * hides a 1px rounding overflow the table has even when everything fits.
 */
export function computeChecklistScroll(input: ChecklistScrollInput): ChecklistScroll {
  const y = input.innerHeight - 400;
  const scrolling: ChecklistScroll = { y: `${y}px` };
  const characterWidth = input.innerWidth <= NARROW_MAX_WIDTH ? CHARACTER_COLUMN_WIDTH_NARROW : CHARACTER_COLUMN_WIDTH;
  const tableWidth = checklistTaskColumnWidth(input.sidebarCollapsed) + characterWidth * input.visibleCharacterCount;
  const sidebarWidth = input.sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN;
  if (tableWidth > input.innerWidth - sidebarWidth - TABLE_BODY_CHROME) {
    scrolling.x = `${tableWidth}px`;
  }
  return scrolling;
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

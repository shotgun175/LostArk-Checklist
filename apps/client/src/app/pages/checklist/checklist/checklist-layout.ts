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

/**
 * nz-table scroll settings for the checklist.
 *
 * y keeps the table body inside the window. x is only set when the visible
 * characters cannot fit; it then uses the real sidebar and task column widths.
 */
export function computeChecklistScroll(input: ChecklistScrollInput): ChecklistScroll {
  const y = input.innerHeight - 400;
  const scrolling: ChecklistScroll = { y: `${y}px` };
  const widthPerCharacter = input.innerWidth < 992 ? 80 : 120;
  if (input.innerWidth < widthPerCharacter * input.visibleCharacterCount + 200) {
    const sidebarWidth = input.sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_OPEN;
    scrolling.x = `${input.innerWidth - sidebarWidth - 48 - checklistTaskColumnWidth(input.sidebarCollapsed) - 20}px`;
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

import { checklistTaskColumnWidth, computeChecklistScroll, formatModeBadge } from './checklist-layout';

describe('checklistTaskColumnWidth', () => {
  it('is 180px with the sidebar collapsed', () => {
    expect(checklistTaskColumnWidth(true)).toBe(180);
  });

  it('is 130px with the sidebar open', () => {
    expect(checklistTaskColumnWidth(false)).toBe(130);
  });
});

describe('computeChecklistScroll', () => {
  it('scrolls sideways for 7 characters at 1080x1920 with the sidebar collapsed', () => {
    // 180 task + 7 x 115 = 985 > 1080 - 80 sidebar - 79 = 921
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 7, sidebarCollapsed: true }))
      .toEqual({ y: '1520px', x: '985px' });
  });

  it('scrolls sideways for 7 characters at 1080x1920 with the sidebar open', () => {
    // 130 task + 7 x 115 = 935 > 1080 - 200 sidebar - 79 = 801
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 7, sidebarCollapsed: false }))
      .toEqual({ y: '1520px', x: '935px' });
  });

  it('does not scroll sideways for 6 characters at 1080x1920 with the sidebar collapsed', () => {
    // 180 + 6 x 115 = 870 <= 921
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 6, sidebarCollapsed: true }))
      .toEqual({ y: '1520px' });
  });

  it('scrolls sideways for 6 characters at 1080x1920 with the sidebar open', () => {
    // 130 + 6 x 115 = 820 > 801
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 6, sidebarCollapsed: false }))
      .toEqual({ y: '1520px', x: '820px' });
  });

  it('does not scroll sideways for 7 characters at 2560x1440 in either sidebar state', () => {
    expect(computeChecklistScroll({ innerWidth: 2560, innerHeight: 1440, visibleCharacterCount: 7, sidebarCollapsed: true }))
      .toEqual({ y: '1040px' });
    expect(computeChecklistScroll({ innerWidth: 2560, innerHeight: 1440, visibleCharacterCount: 7, sidebarCollapsed: false }))
      .toEqual({ y: '1040px' });
  });

  it('sets x to the full table width when 15 characters are shown', () => {
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 15, sidebarCollapsed: false }))
      .toEqual({ y: '1520px', x: '1855px' });
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 15, sidebarCollapsed: true }))
      .toEqual({ y: '1520px', x: '1905px' });
  });

  it('uses 66px per character at 992px and below', () => {
    // 180 + 7 x 66 = 642 > 390 - 80 - 79 = 231
    expect(computeChecklistScroll({ innerWidth: 390, innerHeight: 844, visibleCharacterCount: 7, sidebarCollapsed: true }))
      .toEqual({ y: '444px', x: '642px' });
    // 180 + 6 x 66 = 576 <= 900 - 80 - 79 = 741
    expect(computeChecklistScroll({ innerWidth: 900, innerHeight: 800, visibleCharacterCount: 6, sidebarCollapsed: true }))
      .toEqual({ y: '400px' });
    // At exactly 992 the narrow width still applies: 180 + 10 x 66 = 840 > 992 - 80 - 79 = 833
    expect(computeChecklistScroll({ innerWidth: 992, innerHeight: 800, visibleCharacterCount: 10, sidebarCollapsed: true }))
      .toEqual({ y: '400px', x: '840px' });
  });
});

describe('formatModeBadge', () => {
  it('keeps NM, HM and Solo as they are', () => {
    expect(formatModeBadge('NM')).toBe('NM');
    expect(formatModeBadge('HM')).toBe('HM');
    expect(formatModeBadge('Solo')).toBe('Solo');
  });

  it('shows Nightmare as NiM, whichever spelling it arrives in', () => {
    expect(formatModeBadge('Nightmare')).toBe('NiM');
    expect(formatModeBadge('NiM')).toBe('NiM');
  });

  it('shortens Mixed to Mix', () => {
    expect(formatModeBadge('Mixed')).toBe('Mix');
  });

  it('shows nothing when no mode is set', () => {
    expect(formatModeBadge(undefined)).toBe('');
    // setRunningModeFlagForGate writes '' to clear a gate
    expect(formatModeBadge('')).toBe('');
  });
});

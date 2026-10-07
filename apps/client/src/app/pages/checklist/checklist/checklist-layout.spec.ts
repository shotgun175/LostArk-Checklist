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
  it('does not force a table width for 6 visible characters at 1080x1920, sidebar collapsed', () => {
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 6, sidebarCollapsed: true }))
      .toEqual({ y: '1520px' });
  });

  it('does not force a table width for 6 visible characters at 1080x1920, sidebar open', () => {
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 6, sidebarCollapsed: false }))
      .toEqual({ y: '1520px' });
  });

  it('uses the open sidebar and task widths when 15 characters are shown', () => {
    // 1080 - 200 sidebar - 48 padding - 130 task column - 20
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 15, sidebarCollapsed: false }))
      .toEqual({ y: '1520px', x: '682px' });
  });

  it('uses the collapsed sidebar and task widths when 15 characters are shown', () => {
    // 1080 - 80 sidebar - 48 padding - 180 task column - 20
    expect(computeChecklistScroll({ innerWidth: 1080, innerHeight: 1920, visibleCharacterCount: 15, sidebarCollapsed: true }))
      .toEqual({ y: '1520px', x: '752px' });
  });

  it('uses 80px per character below 992px', () => {
    // 10 x 80 + 200 = 1000 > 900, so x = 900 - 80 - 48 - 180 - 20
    expect(computeChecklistScroll({ innerWidth: 900, innerHeight: 800, visibleCharacterCount: 10, sidebarCollapsed: true }))
      .toEqual({ y: '400px', x: '572px' });
    // 6 x 80 + 200 = 680 < 900, no forced width
    expect(computeChecklistScroll({ innerWidth: 900, innerHeight: 800, visibleCharacterCount: 6, sidebarCollapsed: true }))
      .toEqual({ y: '400px' });
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

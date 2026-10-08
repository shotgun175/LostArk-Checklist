import {
  checklistBodyHeight,
  checklistTaskColumnWidth,
  computeChecklistScroll,
  formatCountdown,
  formatModeBadge,
  getGoldBadge,
  goldBadgeTooltip,
  isWeeklyFrequency
} from './checklist-layout';
import { TaskFrequency } from '../../../model/task-frequency';

const at = (innerWidth: number, innerHeight: number, visibleCharacterCount: number, sidebarCollapsed: boolean) =>
  ({ innerWidth, innerHeight, visibleCharacterCount, sidebarCollapsed });

describe('checklistTaskColumnWidth', () => {
  it('is 180px with the sidebar collapsed when the characters fill the width', () => {
    expect(checklistTaskColumnWidth(at(1080, 1920, 7, true))).toBe(180);
  });

  it('is 130px with the sidebar open when the characters fill the width', () => {
    expect(checklistTaskColumnWidth(at(1080, 1920, 7, false))).toBe(130);
  });

  it('grows into free space with few characters, up to 240px', () => {
    // 1080 - 200 - 55 = 825 available; 130 + 6 x 115 = 820 leaves 5px
    expect(checklistTaskColumnWidth(at(1080, 1920, 6, false))).toBe(135);
    expect(checklistTaskColumnWidth(at(1920, 1080, 1, false))).toBe(240);
    expect(checklistTaskColumnWidth(at(1920, 1080, 1, true))).toBe(240);
  });

  it('is 110px on a phone', () => {
    expect(checklistTaskColumnWidth(at(390, 844, 7, true))).toBe(110);
    expect(checklistTaskColumnWidth(at(390, 844, 1, false))).toBe(110);
  });
});

describe('computeChecklistScroll', () => {
  it('scrolls sideways for 7 characters at 1080x1920 with the sidebar collapsed', () => {
    // 180 task + 7 x 115 = 985 > 1080 - 80 sidebar - 55 = 945
    expect(computeChecklistScroll(at(1080, 1920, 7, true)))
      .toEqual({ y: '1520px', x: '985px' });
  });

  it('scrolls sideways for 7 characters at 1080x1920 with the sidebar open', () => {
    // 130 task + 7 x 115 = 935 > 1080 - 200 sidebar - 55 = 825
    expect(computeChecklistScroll(at(1080, 1920, 7, false)))
      .toEqual({ y: '1520px', x: '935px' });
  });

  it('does not scroll sideways for 6 characters at 1080x1920 in either sidebar state', () => {
    // collapsed: 180 + 6 x 115 = 870 <= 945; open: 135 + 6 x 115 = 825 <= 825
    expect(computeChecklistScroll(at(1080, 1920, 6, true))).toEqual({ y: '1520px' });
    expect(computeChecklistScroll(at(1080, 1920, 6, false))).toEqual({ y: '1520px' });
  });

  it('does not scroll sideways for 7 characters at 2560x1440 in either sidebar state', () => {
    expect(computeChecklistScroll(at(2560, 1440, 7, true))).toEqual({ y: '1040px' });
    expect(computeChecklistScroll(at(2560, 1440, 7, false))).toEqual({ y: '1040px' });
  });

  it('sets x to the full table width when 15 characters are shown', () => {
    expect(computeChecklistScroll(at(1080, 1920, 15, false))).toEqual({ y: '1520px', x: '1855px' });
    expect(computeChecklistScroll(at(1080, 1920, 15, true))).toEqual({ y: '1520px', x: '1905px' });
  });

  it('uses 76px per character at 992px and below, and a 110px task column on a phone', () => {
    // 110 + 7 x 76 = 642 > 390 - 80 - 55 = 255
    expect(computeChecklistScroll(at(390, 844, 7, true))).toEqual({ y: '444px', x: '642px' });
    // 180 + 6 x 76 = 636 <= 900 - 80 - 55 = 765
    expect(computeChecklistScroll(at(900, 800, 6, true))).toEqual({ y: '400px' });
    // At exactly 992 the narrow width still applies: 180 + 10 x 76 = 940 > 992 - 80 - 55 = 857
    expect(computeChecklistScroll(at(992, 800, 10, true))).toEqual({ y: '400px', x: '940px' });
  });

  it('uses the measured body height once the table has rendered', () => {
    expect(computeChecklistScroll({ ...at(1080, 1920, 7, true), bodyHeight: 1388 })).toEqual({ y: '1388px', x: '985px' });
    expect(computeChecklistScroll({ ...at(1080, 1920, 7, true), bodyHeight: null })).toEqual({ y: '1520px', x: '985px' });
  });
});

describe('checklistBodyHeight', () => {
  it('ends the body where the footer starts, so the page does not scroll', () => {
    // 1856 visible, body starts 380px down, 66px footer + 16px padding + 1px border under it
    expect(checklistBodyHeight({ viewportHeight: 1856, bodyTop: 380, belowBody: 83 })).toBe(1393);
  });

  it('rounds down, so a fractional position never adds a scroll', () => {
    expect(checklistBodyHeight({ viewportHeight: 1856, bodyTop: 380.4, belowBody: 83 })).toBe(1392);
  });

  it('keeps at least 300px on a short window', () => {
    expect(checklistBodyHeight({ viewportHeight: 780, bodyTop: 560, belowBody: 160 })).toBe(300);
  });
});

describe('formatCountdown', () => {
  it('shows HH:mm:ss under 24 hours', () => {
    expect(formatCountdown(((14 * 60 + 9) * 60 + 23) * 1000)).toBe('14:09:23');
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('shows the days in front from 24 hours on', () => {
    expect(formatCountdown(86400000)).toBe('1d 00:00:00');
    // 134:09:23 before
    expect(formatCountdown(((134 * 60 + 9) * 60 + 23) * 1000)).toBe('5d 14:09:23');
  });

  it('drops milliseconds and never goes negative', () => {
    expect(formatCountdown(1999)).toBe('00:00:01');
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });
});

describe('goldBadgeTooltip', () => {
  it('names the mode and whether the raid earns gold', () => {
    expect(goldBadgeTooltip('NM', true)).toBe('Normal Mode, earns gold');
    expect(goldBadgeTooltip('HM', false)).toBe('Hard Mode, no gold');
    expect(goldBadgeTooltip('NiM', true)).toBe('Nightmare Mode, earns gold');
    expect(goldBadgeTooltip('Solo', true)).toBe('Solo Mode, earns gold');
    expect(goldBadgeTooltip('Mix', false)).toBe('Mixed modes, no gold');
  });

  it('covers a coin without a mode', () => {
    expect(goldBadgeTooltip('', true)).toBe('Earns gold');
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

describe('getGoldBadge', () => {
  it('shows the mode without a coin when the raid earns no gold', () => {
    expect(getGoldBadge('HM', false, true)).toEqual({ show: true, coin: false });
    expect(getGoldBadge('HM', true, false)).toEqual({ show: true, coin: false });
  });

  it('adds the coin only when Taking Gold is ticked on a weekly gold character', () => {
    expect(getGoldBadge('HM', true, true)).toEqual({ show: true, coin: true });
    expect(getGoldBadge('', true, true)).toEqual({ show: true, coin: true });
  });

  it('shows nothing without a mode or gold', () => {
    expect(getGoldBadge('', false, true)).toEqual({ show: false, coin: false });
    expect(getGoldBadge('', true, false)).toEqual({ show: false, coin: false });
  });
});

describe('isWeeklyFrequency', () => {
  it('treats weekly and both bi-weekly frequencies as weekly', () => {
    expect(isWeeklyFrequency(TaskFrequency.WEEKLY)).toBe(true);
    expect(isWeeklyFrequency(TaskFrequency.BIWEEKLY)).toBe(true);
    expect(isWeeklyFrequency(TaskFrequency.BIWEEKLY_OFFSET)).toBe(true);
  });

  it('does not treat daily or one-time tasks as weekly', () => {
    expect(isWeeklyFrequency(TaskFrequency.DAILY)).toBe(false);
    expect(isWeeklyFrequency(TaskFrequency.ONE_TIME)).toBe(false);
  });
});

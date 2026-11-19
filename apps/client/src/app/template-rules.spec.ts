import * as fs from 'fs';
import * as path from 'path';

/** Every component template in the app, as [path relative to this folder, parsed document]. */
function templates(): [string, Document][] {
  const found: [string, Document][] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(full, 'utf8');
        found.push([path.relative(__dirname, full).replace(/\\/g, '/'), new DOMParser().parseFromString(html, 'text/html')]);
      }
    }
  };
  walk(__dirname);
  return found;
}

/** Each element matching the selector, as "<template>: <start of its markup>". */
function offenders(selector: string): string[] {
  return templates().flatMap(([file, doc]) =>
    [...doc.querySelectorAll(selector)].map(element => `${file}: ${element.outerHTML.replace(/\s+/g, ' ').slice(0, 80)}`)
  );
}

/**
 * Overlay hosts (tooltip, also in its bound form, popover, popconfirm) inside a checkbox or radio host.
 * Those hosts toggle on a click anywhere inside them, and a click or tap is how the overlay opens.
 */
const OVERLAY_HOST_IN_TOGGLE = [':is([nz-checkbox], [nz-radio], [nz-radio-button])']
  .flatMap(toggle => ['[nz-tooltip]', '[\\[nz-tooltip\\]]', '[nz-popover]', '[nz-popconfirm]'].map(host => `${toggle} ${host}`))
  .join(', ');

describe('template rules', () => {
  it('finds the app templates', () => {
    expect(templates().map(([file]) => file)).toContain('pages/checklist/checklist/checklist.component.html');
  });

  it('recognizes every form of an overlay host inside a checkbox or radio', () => {
    const doc = new DOMParser().parseFromString(`
      <label nz-checkbox>A <span nz-icon nz-tooltip nzTooltipTitle="a"></span></label>
      <label nz-checkbox>B <span nz-icon [nz-tooltip]="hint"></span></label>
      <span nz-checkbox>C <button nz-popover></button></span>
      <label nz-radio>D <a nz-popconfirm></a></label>
      <label nz-radio-button>E <span nz-tooltip></span></label>
      <span class="checkbox-with-info"><label nz-checkbox>F</label><span nz-icon nz-tooltip></span></span>`, 'text/html');
    expect([...doc.querySelectorAll(OVERLAY_HOST_IN_TOGGLE)].map(el => el.parentElement?.textContent?.trim().charAt(0))).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  // A checkbox or radio toggles on a click anywhere inside its host, and a click or tap is how a tooltip icon
  // is opened on a phone, so an icon inside it would change the choice it explains
  it('keeps tooltip, popover and popconfirm hosts out of checkboxes and radios', () => {
    expect(offenders(OVERLAY_HOST_IN_TOGGLE)).toEqual([]);
  });
});

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

describe('template rules', () => {
  it('finds the app templates', () => {
    expect(templates().map(([file]) => file)).toContain('pages/checklist/checklist/checklist.component.html');
  });

  // An nz-checkbox label toggles on a click anywhere inside it, and a click or tap is how a tooltip icon
  // is opened on a phone, so an icon inside the label would change the choice it explains
  it('keeps tooltip icons out of checkbox labels', () => {
    expect(offenders('label[nz-checkbox] [nz-tooltip]')).toEqual([]);
  });
});

import * as fs from 'fs';
import * as path from 'path';

const APP = path.resolve(__dirname, '../..');

/** Every non-spec .ts file under app/ that imports ng-zorro's tooltip entry point, relative to app/. */
function tooltipImporters(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        && /from\s+["']ng-zorro-antd\/tooltip["']/.test(fs.readFileSync(full, 'utf8'))) {
        found.push(path.relative(APP, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(APP);
  return found;
}

describe('TapTooltipModule', () => {
  it('finds the tooltip imports it guards', () => {
    expect(tooltipImporters()).toContain('components/tap-tooltip/tap-tooltip.module.ts');
  });

  // A module that imports NzTooltipModule directly gets tooltips that never open on a tap on phones, with no error to say so
  it('is the only way into ng-zorro tooltips: nothing outside components/tap-tooltip imports ng-zorro-antd/tooltip', () => {
    expect(tooltipImporters().filter(file => !file.startsWith('components/tap-tooltip/'))).toEqual([]);
  });
});

import { ChangeDetectionStrategy, Component, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NzSelectComponent, NzSelectModule } from 'ng-zorro-antd/select';
import { SteadySelectDropdownModule } from './steady-select-dropdown.module';

@Component({
  template: `
    <nz-select lostarkHelperSteadyDropdown [(ngModel)]="value">
      <nz-option nzValue="a" nzLabel="A"></nz-option>
    </nz-select>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
class SelectComponent {
  value = null;
}

@Component({
  template: `
    <nz-select lostarkHelperSteadyDropdown [nzPlacement]="placement()" [(ngModel)]="value">
      <nz-option nzValue="a" nzLabel="A"></nz-option>
    </nz-select>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
class PlacedSelectComponent {
  readonly placement = signal<'topLeft' | 'bottomRight'>('topLeft');
  value = null;
}

describe('SteadySelectDropdownDirective', () => {
  const setup = <T>(host: Type<T>) => {
    TestBed.configureTestingModule({
      declarations: [host],
      imports: [SteadySelectDropdownModule, NzSelectModule, FormsModule, NoopAnimationsModule]
    });
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(NzSelectComponent)).componentInstance as NzSelectComponent;
    // The sides the dropdown's overlay checks: where the field and the dropdown meet, and the gap between them
    const sides = () => select.cdkConnectedOverlay.positions.map(p => `${p.originX} ${p.originY} / ${p.overlayX} ${p.overlayY} ${p.offsetY}`);
    return { fixture, sides };
  };

  it('keeps the overlay\'s own sides when the select names no placement, below with +4 and above with -4', () => {
    const { sides } = setup(SelectComponent);
    expect(sides()).toEqual([
      'start bottom / start top 4',
      'start top / start bottom -4',
      'end top / end bottom -4',
      'end bottom / end top 4'
    ]);
  });

  it('follows a placement the select names, also when it changes later', () => {
    const { fixture, sides } = setup(PlacedSelectComponent);
    expect(sides()).toEqual(['start top / start bottom -4']);
    fixture.componentInstance.placement.set('bottomRight');
    fixture.detectChanges();
    expect(sides()).toEqual(['end bottom / end top 4']);
  });
});

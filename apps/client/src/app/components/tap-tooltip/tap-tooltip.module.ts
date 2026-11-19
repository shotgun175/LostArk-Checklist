import { NgModule } from "@angular/core";
import { NzTooltipModule } from "ng-zorro-antd/tooltip";
import { TapTooltipDirective } from "./tap-tooltip.directive";

/**
 * ng-zorro's tooltips, plus TapTooltipDirective so a hover tooltip also opens on a tap on touch screens.
 * Every module with tooltips imports this one, never NzTooltipModule directly (tap-tooltip.module.spec.ts checks it).
 */
@NgModule({
  declarations: [TapTooltipDirective],
  imports: [NzTooltipModule],
  exports: [NzTooltipModule, TapTooltipDirective]
})
export class TapTooltipModule {
}

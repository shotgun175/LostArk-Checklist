import { NgModule } from "@angular/core";
import { SteadySelectDropdownDirective } from "./steady-select-dropdown.directive";

/** For the pages with selects: `lostarkHelperSteadyDropdown` keeps a select's dropdown from flickering between sides. */
@NgModule({
  declarations: [SteadySelectDropdownDirective],
  exports: [SteadySelectDropdownDirective]
})
export class SteadySelectDropdownModule {
}

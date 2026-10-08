import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { GoldPlannerComponent } from "./gold-planner/gold-planner.component";
import { RouterModule, Routes } from "@angular/router";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { FormsModule } from "@angular/forms";
import { NzPageHeaderModule } from "ng-zorro-antd/page-header";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { IconsProviderModule } from "../../icons-provider.module";
import { NzTooltipModule } from "ng-zorro-antd/tooltip";
import { NzInputNumberLegacyModule } from "ng-zorro-antd/input-number-legacy";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzButtonModule } from "ng-zorro-antd/button";

const routes: Routes = [{
  path: "",
  component: GoldPlannerComponent
}];

@NgModule({
  declarations: [GoldPlannerComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NzSwitchModule,
    NzRadioModule,
    FormsModule,
    NzPageHeaderModule,
    NzCheckboxModule,
    IconsProviderModule,
    NzTooltipModule,
    NzInputModule,
    NzInputNumberLegacyModule,
    NzButtonModule
  ]
})
export class GoldPlannerModule {
}

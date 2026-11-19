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
import { TapTooltipModule } from "../../components/tap-tooltip/tap-tooltip.module";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzEmptyModule } from "ng-zorro-antd/empty";

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
    TapTooltipModule,
    NzInputNumberModule,
    NzButtonModule,
    NzEmptyModule
  ]
})
export class GoldPlannerModule {
}

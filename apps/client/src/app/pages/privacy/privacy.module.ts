import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Routes } from "@angular/router";
import { NzPageHeaderModule } from "ng-zorro-antd/page-header";
import { PrivacyComponent } from "./privacy/privacy.component";

const routes: Routes = [{ path: "", component: PrivacyComponent }];

@NgModule({
  declarations: [PrivacyComponent],
  imports: [CommonModule, RouterModule.forChild(routes), NzPageHeaderModule]
})
export class PrivacyModule {
}

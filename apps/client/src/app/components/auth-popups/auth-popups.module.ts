import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterPopupComponent } from './register-popup/register-popup.component';
import { LoginPopupComponent } from './login-popup/login-popup.component';
import { NzFormModule } from "ng-zorro-antd/form";
import { ReactiveFormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { IconsProviderModule } from "../../icons-provider.module";

@NgModule({
  declarations: [RegisterPopupComponent, LoginPopupComponent],
  imports: [CommonModule, NzFormModule, ReactiveFormsModule, NzButtonModule, NzInputModule, NzAlertModule, IconsProviderModule]
})
export class AuthPopupsModule {}

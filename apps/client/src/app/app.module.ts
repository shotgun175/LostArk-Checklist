import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { en_US, NZ_I18N } from "ng-zorro-antd/i18n";
import { registerLocaleData } from "@angular/common";
import en from "@angular/common/locales/en";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AppRoutingModule } from "./app-routing.module";
import { IconsProviderModule } from "./icons-provider.module";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzMenuModule } from "ng-zorro-antd/menu";
import { environment } from "../environments/environment";
import { provideFirebase } from "./core/firebase/firebase.providers";
import { NzDropdownModule } from "ng-zorro-antd/dropdown";
import { AuthPopupsModule } from "./components/auth-popups/auth-popups.module";
import { NzModalModule } from "ng-zorro-antd/modal";
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';


registerLocaleData(en);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    IconsProviderModule,
    NzLayoutModule,
    NzMenuModule,
    NzDropdownModule,
    AuthPopupsModule,
    NzModalModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: en_US },
    ...provideFirebase(environment),
    provideHttpClient(withInterceptorsFromDi()), provideNzDateFnsAdapter()
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}

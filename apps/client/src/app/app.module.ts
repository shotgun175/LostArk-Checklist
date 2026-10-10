import { inject, NgModule, provideAppInitializer } from "@angular/core";
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
import { FIRESTORE, provideFirebase } from "./core/firebase/firebase.providers";
import { clearRequestedLocalData, localDataClearRequested } from "./core/firebase/local-data.service";
import { NzDropdownModule } from "ng-zorro-antd/dropdown";
import { AuthPopupsModule } from "./components/auth-popups/auth-popups.module";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzTooltipModule } from "ng-zorro-antd/tooltip";
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { CdkScrollableModule } from "@angular/cdk/scrolling";
import { provideServiceWorker } from "@angular/service-worker";


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
    NzModalModule,
    NzAlertModule,
    NzButtonModule,
    NzTooltipModule,
    CdkScrollableModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: en_US },
    ...provideFirebase(environment),
    // After Log out, Sign in or an account deletion, the previous account's data is deleted from
    // this browser before anything reads Firestore.
    provideAppInitializer(() => localDataClearRequested() ? clearRequestedLocalData(inject(FIRESTORE)) : undefined),
    provideHttpClient(withInterceptorsFromDi()), provideNzDateFnsAdapter(),
    // Registers once the app is stable, or after 30 s at the latest, so it does not compete with the first load.
    provideServiceWorker("ngsw-worker.js", {
      enabled: environment.serviceWorker,
      registrationStrategy: "registerWhenStable:30000"
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}

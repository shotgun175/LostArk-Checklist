import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { en_US, NZ_I18N } from "ng-zorro-antd/i18n";
import { registerLocaleData } from "@angular/common";
import en from "@angular/common/locales/en";
import { HttpClientModule } from "@angular/common/http";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { AppRoutingModule } from "./app-routing.module";
import { IconsProviderModule } from "./icons-provider.module";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzMenuModule } from "ng-zorro-antd/menu";
import { initializeApp, provideFirebaseApp } from "@angular/fire/app";
import { environment } from "../environments/environment";
import { connectAuthEmulator, getAuth, provideAuth } from "@angular/fire/auth";
import { connectFirestoreEmulator, getFirestore, provideFirestore } from "@angular/fire/firestore";
import { USE_DEVICE_LANGUAGE } from "@angular/fire/compat/auth";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { AuthPopupsModule } from "./components/auth-popups/auth-popups.module";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzMessageModule } from "ng-zorro-antd/message";

registerLocaleData(en);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    IconsProviderModule,
    NzLayoutModule,
    NzMenuModule,
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        connectAuthEmulator(auth, "http://localhost:9099");
      }
      return auth;
    }),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, "localhost", 8085);
      }
      return firestore;
    }),
    NzDropDownModule,
    AuthPopupsModule,
    NzModalModule,
    NzMessageModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: en_US },
    { provide: USE_DEVICE_LANGUAGE, useValue: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}

import { BehaviorSubject, firstValueFrom } from "rxjs";
import { UntypedFormBuilder } from "@angular/forms";
import { NzModalRef } from "ng-zorro-antd/modal";
import { NzMessageService } from "ng-zorro-antd/message";
import { AuthService } from "../../../core/database/services/auth.service";
import { RosterService } from "../../../core/database/services/roster.service";
import { DataTransferService } from "../../../core/import/data-transfer.service";
import { LoginPopupComponent } from "./login-popup.component";

jest.mock("../../../core/database/services/auth.service", () => ({ AuthService: class {} }));
jest.mock("../../../core/database/services/roster.service", () => ({ RosterService: class {} }));
jest.mock("../../../core/import/data-transfer.service", () => ({ DataTransferService: class {} }));

describe("LoginPopupComponent", () => {
  function create(anonymous: boolean, characters: number) {
    const isAnonymous$ = new BehaviorSubject(anonymous);
    const roster$ = new BehaviorSubject({ characters: Array.from({ length: characters }, (_, i) => ({ id: i, name: `Synthetic ${i}` })) });
    const close = jest.fn();
    const component = new LoginPopupComponent(new UntypedFormBuilder(), { isAnonymous$ } as unknown as AuthService,
      { close } as unknown as NzModalRef, { roster$ } as unknown as RosterService, {} as DataTransferService,
      {} as NzMessageService);
    return { component, close };
  }

  it("counts a guest's characters for the warning", async () => {
    expect(await firstValueFrom(create(true, 3).component.guestCharacterCount$)).toBe(3);
  });

  it("shows no warning for a guest without characters or for a registered user", async () => {
    expect(await firstValueFrom(create(true, 0).component.guestCharacterCount$)).toBe(0);
    expect(await firstValueFrom(create(false, 3).component.guestCharacterCount$)).toBe(0);
  });

  it("enables Forgot your password only for a valid email", () => {
    const { component } = create(true, 0);
    expect(component.form.controls["email"].invalid).toBe(true);
    component.form.controls["email"].setValue("synthetic.player@example.com");
    expect(component.form.controls["email"].invalid).toBe(false);
  });

  it("closes with a switch to Register", () => {
    const { component, close } = create(true, 2);
    component.switchToRegister();
    expect(close).toHaveBeenCalledWith("register");
  });
});

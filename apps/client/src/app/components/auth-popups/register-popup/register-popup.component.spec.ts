import { of } from "rxjs";
import { UntypedFormBuilder } from "@angular/forms";
import { NzModalRef } from "ng-zorro-antd/modal";
import { NzMessageService } from "ng-zorro-antd/message";
import { AuthService } from "../../../core/database/services/auth.service";
import { UserService } from "../../../core/database/services/user.service";
import { RegisterPopupComponent } from "./register-popup.component";

jest.mock("../../../core/database/services/auth.service", () => ({ AuthService: class {} }));
jest.mock("../../../core/database/services/user.service", () => ({ UserService: class {} }));

describe("RegisterPopupComponent", () => {
  function create() {
    const register = jest.fn(() => of({ user: { uid: "u1" } }));
    const setOne = jest.fn(() => of(void 0));
    const close = jest.fn();
    const success = jest.fn();
    const component = new RegisterPopupComponent(new UntypedFormBuilder(), { register } as unknown as AuthService,
      { close } as unknown as NzModalRef, { setOne } as unknown as UserService, { success } as unknown as NzMessageService);
    return { component, register, setOne, close, success };
  }

  function fill(component: RegisterPopupComponent, displayName: string): void {
    component.form.setValue({ displayName, email: "synthetic.player@example.com", password: "secret-1", confirmPassword: "secret-1" });
  }

  it("treats the display name as optional", () => {
    const { component } = create();
    fill(component, "");
    expect(component.form.valid).toBe(true);
  });

  it("uses the part of the email before the @ for a blank display name", () => {
    const { component, setOne, success, close } = create();
    fill(component, "   ");
    component.submit();
    expect(setOne).toHaveBeenCalledWith("u1", { name: "synthetic.player" });
    expect(success).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith();
  });

  it("saves a typed display name, cleaned", () => {
    const { component, setOne } = create();
    fill(component, "  Synthetic   Sorc ");
    component.submit();
    expect(setOne).toHaveBeenCalledWith("u1", { name: "Synthetic Sorc" });
  });

  it("shows Passwords do not match only after something was typed in Confirmation", () => {
    const { component } = create();
    component.form.patchValue({ password: "secret-1" });
    expect(component.showPasswordMismatch).toBe(false);
    const confirm = component.form.get("confirmPassword");
    confirm?.setValue("secret");
    confirm?.markAsDirty();
    expect(component.showPasswordMismatch).toBe(true);
    confirm?.setValue("");
    expect(component.showPasswordMismatch).toBe(false);
  });

  it("closes with a switch to Sign in", () => {
    const { component, close } = create();
    component.switchToSignIn();
    expect(close).toHaveBeenCalledWith("sign-in");
  });
});

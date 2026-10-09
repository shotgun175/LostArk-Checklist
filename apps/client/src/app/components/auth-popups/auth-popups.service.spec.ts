import { Subject } from "rxjs";
import { NzModalService } from "ng-zorro-antd/modal";
import { AuthPopupsService, AuthPopupSwitch } from "./auth-popups.service";

// The popups pull in Firebase through their services; only their titles matter here.
jest.mock("./login-popup/login-popup.component", () => ({ LoginPopupComponent: class {} }));
jest.mock("./register-popup/register-popup.component", () => ({ RegisterPopupComponent: class {} }));

describe("AuthPopupsService", () => {
  let closes: Subject<AuthPopupSwitch | undefined>[];
  let create: jest.Mock;
  let service: AuthPopupsService;

  beforeEach(() => {
    closes = [];
    create = jest.fn(() => {
      const afterClose = new Subject<AuthPopupSwitch | undefined>();
      closes.push(afterClose);
      return { afterClose };
    });
    service = new AuthPopupsService({ create } as unknown as NzModalService);
  });

  const titles = () => create.mock.calls.map(([options]) => options.nzTitle);

  it("gives each popup a title", () => {
    service.openSignIn();
    service.openRegister();
    expect(titles()).toEqual(["Sign in", "Create an account"]);
  });

  it("opens the other popup when one closes with a switch", () => {
    service.openSignIn();
    closes[0].next("register");
    expect(titles()).toEqual(["Sign in", "Create an account"]);
    closes[1].next("sign-in");
    expect(titles()).toEqual(["Sign in", "Create an account", "Sign in"]);
  });

  it("opens nothing else when a popup just closes", () => {
    service.openRegister();
    closes[0].next(undefined);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

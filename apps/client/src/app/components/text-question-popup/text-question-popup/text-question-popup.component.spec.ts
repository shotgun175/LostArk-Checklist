import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { NZ_MODAL_DATA, NzModalRef } from "ng-zorro-antd/modal";
import { TextQuestionPopupModule } from "../text-question-popup.module";
import { TextQuestionPopupComponent } from "./text-question-popup.component";
import { displayNameValidator } from "../../../core/display-name";

describe("TextQuestionPopupComponent", () => {
  function create(data: unknown) {
    const modalRef = { close: jest.fn() };
    TestBed.configureTestingModule({
      imports: [TextQuestionPopupModule, NoopAnimationsModule],
      providers: [
        { provide: NZ_MODAL_DATA, useValue: data },
        { provide: NzModalRef, useValue: modalRef }
      ]
    });
    const fixture = TestBed.createComponent(TextQuestionPopupComponent);
    fixture.detectChanges();
    return { fixture, modalRef };
  }

  it("reads placeholder and type from the modal data", () => {
    const { fixture } = create({ placeholder: "Username", type: "input" });
    const input: HTMLInputElement | null = fixture.nativeElement.querySelector("input");
    expect(input?.placeholder).toBe("Username");
    expect(fixture.nativeElement.querySelector("textarea")).toBeNull();
  });

  it("falls back to an empty textarea when no data is passed", () => {
    const { fixture } = create(undefined);
    const textarea: HTMLTextAreaElement | null = fixture.nativeElement.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.placeholder).toBe("");
  });

  it("shows the description line above the field when one is passed", () => {
    const { fixture } = create({ placeholder: "Paste here", description: "This replaces all characters in your roster." });
    const description: HTMLElement | null = fixture.nativeElement.querySelector(".popup-description");
    expect(description?.textContent?.trim()).toBe("This replaces all characters in your roster.");
  });

  it("shows no description line when none is passed", () => {
    const { fixture } = create({ placeholder: "Paste here" });
    expect(fixture.nativeElement.querySelector(".popup-description")).toBeNull();
  });

  it("closes the modal with the entered text on submit", () => {
    const { fixture, modalRef } = create({ placeholder: "Paste here" });
    fixture.componentInstance.control.setValue("hello");
    fixture.componentInstance.submit();
    expect(modalRef.close).toHaveBeenCalledWith("hello");
  });

  it("has no Cancel button unless asked", () => {
    const { fixture } = create({ type: "input" });
    expect(fixture.nativeElement.querySelectorAll("button").length).toBe(1);
  });

  it("closes without an answer from Cancel", () => {
    const { fixture, modalRef } = create({ type: "input", baseText: "Arwen", cancellable: true });
    const cancel: HTMLButtonElement = [...fixture.nativeElement.querySelectorAll("button")].find((b: HTMLButtonElement) => b.textContent?.trim() === "Cancel");
    cancel.click();
    expect(modalRef.close).toHaveBeenCalledWith();
  });

  it("starts with the current text, selected, and applies maxlength and autocomplete", fakeAsync(() => {
    const { fixture } = create({ type: "input", baseText: "Arwen", selectOnOpen: true, maxLength: 32, autocomplete: "nickname" });
    const input: HTMLInputElement = fixture.nativeElement.querySelector("input");
    document.body.appendChild(fixture.nativeElement);
    tick(100);
    expect(input.value).toBe("Arwen");
    expect(input.getAttribute("maxlength")).toBe("32");
    expect(input.getAttribute("autocomplete")).toBe("nickname");
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    fixture.nativeElement.remove();
  }));

  it("applies an extra validator to the answer", () => {
    const { fixture } = create({ type: "input", validator: displayNameValidator });
    fixture.componentInstance.control.setValue("   ");
    expect(fixture.componentInstance.control.valid).toBe(false);
    fixture.componentInstance.control.setValue("Arwen");
    expect(fixture.componentInstance.control.valid).toBe(true);
  });
});

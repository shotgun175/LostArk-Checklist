import { TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { NZ_MODAL_DATA, NzModalRef } from "ng-zorro-antd/modal";
import { TextQuestionPopupModule } from "../text-question-popup.module";
import { TextQuestionPopupComponent } from "./text-question-popup.component";

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
});

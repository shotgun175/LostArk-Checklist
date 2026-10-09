import { AfterViewInit, Component, ElementRef, inject, OnInit, ChangeDetectionStrategy, ViewChild } from "@angular/core";
import { NZ_MODAL_DATA, NzModalRef } from "ng-zorro-antd/modal";
import { UntypedFormControl, ValidatorFn, Validators } from "@angular/forms";

export interface TextQuestionPopupData {
  baseText?: string;
  placeholder?: string;
  /** A line of text shown above the field. */
  description?: string;
  type?: "textarea" | "input";
  /** maxlength of the field. */
  maxLength?: number;
  /** autocomplete attribute of the input, for example "nickname". */
  autocomplete?: string;
  /** Shows a Cancel button that closes the popup without an answer. */
  cancellable?: boolean;
  /** Focuses the field and selects its text when the popup opens, so typing replaces it. */
  selectOnOpen?: boolean;
  /** Checked as well as "required". */
  validator?: ValidatorFn;
}

@Component({
  selector: "lostark-helper-text-question-popup",
  templateUrl: "./text-question-popup.component.html",
  styleUrls: ["./text-question-popup.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class TextQuestionPopupComponent implements OnInit, AfterViewInit {

  private readonly data: TextQuestionPopupData = inject(NZ_MODAL_DATA) ?? {};

  baseText = this.data.baseText ?? "";

  placeholder = this.data.placeholder ?? "";

  description = this.data.description ?? "";

  type: "textarea" | "input" = this.data.type ?? "textarea";

  maxLength = this.data.maxLength ?? null;

  autocomplete = this.data.autocomplete ?? null;

  cancellable = this.data.cancellable ?? false;

  public control!: UntypedFormControl;

  @ViewChild("field") private field?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  constructor(private modalRef: NzModalRef) {
  }

  public submit(): void {
    this.modalRef.close(this.control.value);
  }

  public cancel(): void {
    this.modalRef.close();
  }

  ngOnInit(): void {
    this.control = new UntypedFormControl(this.baseText, this.data.validator ? [Validators.required, this.data.validator] : Validators.required);
  }

  ngAfterViewInit(): void {
    if (this.data.selectOnOpen) {
      // After the modal's own autofocus, which runs once the open animation has started.
      setTimeout(() => {
        this.field?.nativeElement.focus();
        this.field?.nativeElement.select();
      }, 50);
    }
  }

}

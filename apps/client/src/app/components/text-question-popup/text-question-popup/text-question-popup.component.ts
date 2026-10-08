import { Component, inject, OnInit } from "@angular/core";
import { NZ_MODAL_DATA, NzModalRef } from "ng-zorro-antd/modal";
import { UntypedFormControl, Validators } from "@angular/forms";

export interface TextQuestionPopupData {
  baseText?: string;
  placeholder?: string;
  type?: "textarea" | "input";
}

@Component({
  selector: "lostark-helper-text-question-popup",
  templateUrl: "./text-question-popup.component.html",
  styleUrls: ["./text-question-popup.component.less"]
})
export class TextQuestionPopupComponent implements OnInit {

  private readonly data: TextQuestionPopupData = inject(NZ_MODAL_DATA) ?? {};

  baseText = this.data.baseText ?? "";

  placeholder = this.data.placeholder ?? "";

  type: "textarea" | "input" = this.data.type ?? "textarea";

  public control!: UntypedFormControl;

  constructor(private modalRef: NzModalRef) {
  }

  public submit(): void {
    this.modalRef.close(this.control.value);
  }

  ngOnInit(): void {
    this.control = new UntypedFormControl(this.baseText, Validators.required);
  }

}

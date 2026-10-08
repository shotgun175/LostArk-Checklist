import { FormControl } from "@angular/forms";
import { showSavedValue } from "./show-saved-value";

describe("showSavedValue", () => {
  it("writes the value to the input without asking ngModel to emit a change (which would run the handler again)", () => {
    const control = new FormControl<string>("typed");
    const onChange = jest.fn();
    control.registerOnChange(onChange);
    showSavedValue({ control }, "Arwen");
    expect(control.value).toBe("Arwen");
    // The second argument is what NgModel uses to decide whether to emit ngModelChange
    expect(onChange).toHaveBeenCalledWith("Arwen", false);
  });
});

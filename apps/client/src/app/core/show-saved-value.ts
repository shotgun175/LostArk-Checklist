/** The part of an NgModel needed to put a value back in its input. */
export interface SavedValueModel {
  control: { setValue(value: unknown, options: { emitViewToModelChange: boolean }): void };
}

/**
 * Shows the saved value again in an input whose edit was rejected. ngModelChange is not emitted,
 * so the change handler does not run again for this value.
 */
export function showSavedValue(model: SavedValueModel, value: unknown): void {
  model.control.setValue(value, { emitViewToModelChange: false });
}

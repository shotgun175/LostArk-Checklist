import { AbstractControl, ValidationErrors } from "@angular/forms";

/** Longest display name, in characters. The inputs use the same limit as maxlength. */
export const DISPLAY_NAME_MAX_LENGTH = 32;

// Control characters (\p{Cc}) and invisible format characters (\p{Cf}: zero-width spaces and joiners,
// direction marks, the byte order mark), plus the line and paragraph separators.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;

/**
 * The display name as saved: invisible and control characters removed, runs of spaces made one,
 * trimmed and cut to DISPLAY_NAME_MAX_LENGTH characters. Anything that is not a string gives "".
 */
export function cleanDisplayName(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  // Line breaks and tabs become spaces before the control characters go, so words stay apart.
  const cleaned = raw.replace(/\s+/g, " ").replace(INVISIBLE_CHARACTERS, "").replace(/ +/g, " ").trim();
  return Array.from(cleaned).slice(0, DISPLAY_NAME_MAX_LENGTH).join("").trim();
}

/** The default display name: the part of the email before the @, cleaned like a typed name. */
export function emailDisplayName(email: string): string {
  return cleanDisplayName(email.split("@")[0]);
}

/** Form validator for a required display name: fails when nothing visible is left after cleaning. */
export function displayNameValidator(control: AbstractControl): ValidationErrors | null {
  return cleanDisplayName(control.value) ? null : { displayName: true };
}

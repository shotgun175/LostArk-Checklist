import { FormControl } from "@angular/forms";
import { cleanDisplayName, DISPLAY_NAME_MAX_LENGTH, displayNameValidator, emailDisplayName } from "./display-name";

describe("cleanDisplayName", () => {
  it("trims and keeps a normal name", () => {
    expect(cleanDisplayName("  Synthetic Sorc  ")).toBe("Synthetic Sorc");
  });

  it("treats a whitespace-only name as empty", () => {
    expect(cleanDisplayName(" \t  ")).toBe("");
  });

  it("removes zero-width, direction and control characters", () => {
    expect(cleanDisplayName("\u200B\u200C\u200D\u2060\uFEFF")).toBe("");
    expect(cleanDisplayName("Mok\u200Boko\u202E\u0007")).toBe("Mokoko");
    expect(cleanDisplayName("Line\nbreak")).toBe("Line break");
  });

  it("makes runs of spaces one space", () => {
    expect(cleanDisplayName("Two    spaces")).toBe("Two spaces");
  });

  it("cuts a long name to the limit without splitting an emoji", () => {
    expect(cleanDisplayName("x".repeat(60))).toHaveLength(DISPLAY_NAME_MAX_LENGTH);
    const emoji = "\u{1F525}".repeat(40);
    expect(Array.from(cleanDisplayName(emoji))).toHaveLength(DISPLAY_NAME_MAX_LENGTH);
  });

  it("gives an empty name for anything that is not a string", () => {
    expect(cleanDisplayName(undefined)).toBe("");
    expect(cleanDisplayName(null)).toBe("");
    expect(cleanDisplayName(42)).toBe("");
  });
});

describe("emailDisplayName", () => {
  it("uses the part of the email before the @", () => {
    expect(emailDisplayName("synthetic.player@example.com")).toBe("synthetic.player");
  });

  it("is cut to the display name limit", () => {
    expect(emailDisplayName(`${"a".repeat(50)}@example.com`)).toBe("a".repeat(DISPLAY_NAME_MAX_LENGTH));
  });
});

describe("displayNameValidator", () => {
  it("fails for an empty, blank or invisible-only name", () => {
    expect(displayNameValidator(new FormControl(""))).toEqual({ displayName: true });
    expect(displayNameValidator(new FormControl("   "))).toEqual({ displayName: true });
    expect(displayNameValidator(new FormControl("\u200B"))).toEqual({ displayName: true });
  });

  it("passes for a visible name", () => {
    expect(displayNameValidator(new FormControl(" Arwen "))).toBeNull();
  });
});

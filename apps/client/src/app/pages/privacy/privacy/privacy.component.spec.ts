import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { PrivacyComponent } from "./privacy.component";

function renderText(): string {
  TestBed.configureTestingModule({
    declarations: [PrivacyComponent],
    imports: [RouterModule.forRoot([])],
    schemas: [NO_ERRORS_SCHEMA]
  });
  const fixture = TestBed.createComponent(PrivacyComponent);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent ?? "";
}

describe("PrivacyComponent", () => {
  it("names the processor, the storage location, retention and both self-service tools", () => {
    const text = renderText();
    expect(text).toContain("Google Firebase");
    expect(text).toContain("United States");
    expect(text).toContain("Until you delete it");
    expect(text).toContain("Download backup");
    expect(text).toContain("Delete my account and data");
    expect(text).toContain("This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.");
    expect(text).toContain("not affiliated with or endorsed by Smilegate or Amazon Games");
  });

  it("lists no contact email and no long dashes", () => {
    const text = renderText();
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

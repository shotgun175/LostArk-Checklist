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

  it("points to the GitHub issues page as the contact, also for people who cannot sign in", () => {
    const text = renderText();
    expect(text).toContain("open an issue on the project's GitHub issues page");
    expect(text).toContain("If you cannot sign in");
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll("a")).map(a => a.getAttribute("href"));
    expect(hrefs).toContain("https://github.com/shotgun175/LostArk-Checklist/issues");
  });

  it("lists no contact email and no long dashes", () => {
    const text = renderText();
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

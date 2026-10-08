import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "lostark-helper-privacy",
  templateUrl: "./privacy.component.html",
  styleUrls: ["./privacy.component.less"],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyComponent {
}

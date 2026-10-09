import {NgModule} from '@angular/core';
import {NZ_ICONS, NzIconModule} from 'ng-zorro-antd/icon';

import {CheckSquareOutline, DeleteOutline, DownloadOutline, DownOutline, HolderOutline, LeftOutline, MenuFoldOutline, MenuOutline, MenuUnfoldOutline, ReloadOutline, RightOutline, UploadOutline} from '@ant-design/icons-angular/icons';

// Icons inside icon-only buttons must be registered here: ng-zorro 14 only marks a button icon-only
// when the icon SVG is already rendered at view init, which happens only for statically loaded icons.
const icons = [CheckSquareOutline, DeleteOutline, DownloadOutline, DownOutline, HolderOutline, LeftOutline, MenuFoldOutline, MenuOutline, MenuUnfoldOutline, ReloadOutline, RightOutline, UploadOutline];

@NgModule({
  imports: [NzIconModule],
  exports: [NzIconModule],
  providers: [
    {provide: NZ_ICONS, useValue: icons}
  ]
})
export class IconsProviderModule {
}

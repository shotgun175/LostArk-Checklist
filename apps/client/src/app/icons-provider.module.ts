import {NgModule} from '@angular/core';
import {NZ_ICONS, NzIconModule} from 'ng-zorro-antd/icon';

import {ArrowUpOutline, BookOutline, CheckOutline, CheckSquareOutline, ClockCircleOutline, CopyOutline, DeleteOutline, DisconnectOutline, DownloadOutline, DownOutline, EditOutline, EyeInvisibleOutline, EyeOutline, FormOutline, GithubOutline, GoldOutline, HolderOutline, InfoCircleOutline, InfoOutline, LeftOutline, LinkOutline, LoginOutline, LogoutOutline, MenuFoldOutline, MenuOutline, MenuUnfoldOutline, MessageOutline, NumberOutline, PlusOutline, ReloadOutline, RightOutline, SettingOutline, SolutionOutline, UploadOutline, UserOutline, UserSwitchOutline} from '@ant-design/icons-angular/icons';

// Every icon the templates use is registered here, so none is fetched at runtime:
// - Icons inside icon-only buttons: ng-zorro 14 only marks a button icon-only when the icon SVG is
//   already rendered at view init, which happens only for statically loaded icons.
// - Offline (installed app, service worker), an icon that was never fetched cannot load.
// A new nzType in a template needs its icon added to this list.
const icons = [ArrowUpOutline, BookOutline, CheckOutline, CheckSquareOutline, ClockCircleOutline, CopyOutline, DeleteOutline, DisconnectOutline, DownloadOutline, DownOutline, EditOutline, EyeInvisibleOutline, EyeOutline, FormOutline, GithubOutline, GoldOutline, HolderOutline, InfoCircleOutline, InfoOutline, LeftOutline, LinkOutline, LoginOutline, LogoutOutline, MenuFoldOutline, MenuOutline, MenuUnfoldOutline, MessageOutline, NumberOutline, PlusOutline, ReloadOutline, RightOutline, SettingOutline, SolutionOutline, UploadOutline, UserOutline, UserSwitchOutline];

@NgModule({
  imports: [NzIconModule],
  exports: [NzIconModule],
  providers: [
    {provide: NZ_ICONS, useValue: icons}
  ]
})
export class IconsProviderModule {
}

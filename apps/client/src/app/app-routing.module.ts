import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

const routes: Routes = [
  { path: "", redirectTo: "checklist", pathMatch: "full" },
  {
    path: "checklist",
    title: "Checklist | Lost Ark Checklist",
    loadChildren: () => import("./pages/checklist/checklist.module").then(m => m.ChecklistModule)
  },
  {
    path: "roster",
    title: "Roster | Lost Ark Checklist",
    loadChildren: () => import("./pages/roster/roster.module").then(m => m.RosterModule)
  },
  {
    path: "tasks-manager",
    title: "Tasks Manager | Lost Ark Checklist",
    loadChildren: () => import("./pages/tasks/tasks.module").then(m => m.TasksModule)
  },
  {
    path: "gold-planner",
    title: "Gold Planner | Lost Ark Checklist",
    loadChildren: () => import("./pages/gold-planner/gold-planner.module").then(m => m.GoldPlannerModule)
  },
  {
    path: "settings",
    title: "Settings | Lost Ark Checklist",
    loadChildren: () => import("./pages/settings/settings.module").then(m => m.SettingsModule)
  },
  {
    path: "privacy",
    title: "Privacy | Lost Ark Checklist",
    loadChildren: () => import("./pages/privacy/privacy.module").then(m => m.PrivacyModule)
  },
  // An unknown address shows the Checklist instead of an empty page.
  { path: "**", redirectTo: "checklist" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}

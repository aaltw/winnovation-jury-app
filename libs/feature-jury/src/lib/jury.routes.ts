import type { Routes } from "@angular/router";

export const juryRoutes: Routes = [
  { path: "", loadComponent: () => import("./join.component").then((m) => m.JoinComponent) },
  {
    path: "home",
    loadComponent: () => import("./event-home.component").then((m) => m.EventHomeComponent),
  },
  { path: "stand", loadComponent: () => import("./stand.component").then((m) => m.StandComponent) },
  {
    path: "compare",
    loadComponent: () => import("./compare.component").then((m) => m.CompareComponent),
  },
  {
    path: "review",
    loadComponent: () => import("./review.component").then((m) => m.ReviewComponent),
  },
  {
    path: "reconcile",
    loadComponent: () => import("./reconcile.component").then((m) => m.ReconcileComponent),
  },
  {
    path: "result",
    loadComponent: () => import("./result.component").then((m) => m.ResultComponent),
  },
];

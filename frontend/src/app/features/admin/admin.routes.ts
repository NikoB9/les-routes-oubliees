import { Routes } from '@angular/router';

import { adminAuthGuard } from '../../core/guards/admin-auth.guard';

export const adminRoutes: Routes = [
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./admin-forbidden-page/admin-forbidden-page').then((module) => module.AdminForbiddenPage),
    title: 'Accès refusé - Les Routes Oubliées',
  },
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./admin-layout/admin-layout').then((module) => module.AdminLayoutShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/admin-dashboard-page').then((module) => module.AdminDashboardPage),
        title: 'Administration - Les Routes Oubliées',
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/admin-home-page').then((module) => module.AdminHomePage),
        title: 'Accueil admin - Les Routes Oubliées',
      },
      {
        path: 'group',
        loadComponent: () =>
          import('./pages/company/admin-company-page').then((module) => module.AdminCompanyPage),
        title: 'Compagnie admin - Les Routes Oubliées',
      },
      {
        path: 'adventurers',
        loadComponent: () =>
          import('./pages/adventurers/admin-adventurers-page').then(
            (module) => module.AdminAdventurersPage,
          ),
        title: 'Aventuriers admin - Les Routes Oubliées',
      },
      {
        path: 'map',
        loadComponent: () => import('./pages/map/admin-map-page').then((module) => module.AdminMapPage),
        title: 'Carte admin - Les Routes Oubliées',
      },
      {
        path: 'notebook',
        loadComponent: () =>
          import('./pages/notebook/admin-notebook-page').then((module) => module.AdminNotebookPage),
        title: 'Quêtes admin - Les Routes Oubliées',
      },
      {
        path: 'media',
        loadComponent: () => import('./pages/media/media-page').then((module) => module.AdminMediaPage),
        title: 'Médias admin - Les Routes Oubliées',
      },
      {
        path: 'administrators',
        loadComponent: () =>
          import('./pages/administrators/administrators-page').then(
            (module) => module.AdminAdministratorsPage,
          ),
        title: 'Administrateurs - Les Routes Oubliées',
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/audit/admin-audit-page').then((module) => module.AdminAuditPage),
        title: 'Audit admin - Les Routes Oubliées',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/admin-settings-page').then((module) => module.AdminSettingsPage),
        title: 'Paramètres admin - Les Routes Oubliées',
      },
      {
        path: 'radar',
        loadComponent: () => import('./pages/radar/radar-page').then((module) => module.AdminRadarPage),
        title: 'Radar admin - Les Routes Oubliées',
      },
      {
        path: 'portal',
        loadComponent: () =>
          import('./pages/portal/admin-portal-page').then((module) => module.AdminPortalPage),
        title: 'Identités portail - Les Routes Oubliées',
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/not-found/admin-not-found-page').then((module) => module.AdminNotFoundPage),
        title: 'Section admin indisponible - Les Routes Oubliées',
      },
    ],
  },
];

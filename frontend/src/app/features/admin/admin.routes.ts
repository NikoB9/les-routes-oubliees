import { ActivatedRouteSnapshot, ResolveFn, Routes } from '@angular/router';

import { adminAuthGuard } from '../../core/guards/admin-auth.guard';

const loadAdminShell = () =>
  import('./admin-shell/admin-shell').then((module) => module.AdminShell);

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Administration - Les Routes Oubliées',
  home: 'Accueil admin - Les Routes Oubliées',
  group: 'Compagnie admin - Les Routes Oubliées',
  adventurers: 'Aventuriers admin - Les Routes Oubliées',
  map: 'Carte admin - Les Routes Oubliées',
  notebook: 'Quêtes admin - Les Routes Oubliées',
  media: 'Médias admin - Les Routes Oubliées',
  administrators: 'Administrateurs - Les Routes Oubliées',
  audit: 'Audit admin - Les Routes Oubliées',
  settings: 'Paramètres admin - Les Routes Oubliées',
  radar: 'Radar admin - Les Routes Oubliées',
  portal: 'Identités portail - Les Routes Oubliées',
};

const adminSectionTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot) =>
  SECTION_TITLES[route.paramMap.get('section') ?? 'dashboard'] ??
  'Administration - Les Routes Oubliées';

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
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: ':section', loadComponent: loadAdminShell, title: adminSectionTitle },
    ],
  },
];

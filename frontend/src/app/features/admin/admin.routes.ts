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
};

const adminSectionTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot) =>
  SECTION_TITLES[route.paramMap.get('section') ?? 'dashboard'] ??
  'Administration - Les Routes Oubliées';

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./admin-login-page/admin-login-page').then((module) => module.AdminLoginPage),
    title: 'Connexion administration - Les Routes Oubliées',
  },
  {
    // Le guard n'est évalué qu'à l'entrée de l'espace admin : la navigation
    // entre sections ne change que le paramètre `:section`, donc l'instance
    // AdminShell est réutilisée (pas de revérification de session ni de
    // rechargement complet à chaque clic).
    path: '',
    canActivate: [adminAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: ':section', loadComponent: loadAdminShell, title: adminSectionTitle },
    ],
  },
];

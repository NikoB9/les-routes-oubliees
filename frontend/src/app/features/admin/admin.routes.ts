import { ActivatedRouteSnapshot, ResolveFn, Routes } from '@angular/router';

import { adminAuthGuard } from '../../core/guards/admin-auth.guard';

const loadAdminShell = () =>
  import('./admin-shell/admin-shell').then((module) => module.AdminShell);

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Administration - Les Routes Oubliees',
  home: 'Accueil admin - Les Routes Oubliees',
  group: 'Compagnie admin - Les Routes Oubliees',
  adventurers: 'Aventuriers admin - Les Routes Oubliees',
  map: 'Carte admin - Les Routes Oubliees',
  notebook: 'Quetes admin - Les Routes Oubliees',
  media: 'Medias admin - Les Routes Oubliees',
  administrators: 'Administrateurs - Les Routes Oubliees',
  audit: 'Audit admin - Les Routes Oubliees',
  settings: 'Parametres admin - Les Routes Oubliees',
};

const adminSectionTitle: ResolveFn<string> = (route: ActivatedRouteSnapshot) =>
  SECTION_TITLES[route.paramMap.get('section') ?? 'dashboard'] ??
  'Administration - Les Routes Oubliees';

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./admin-login-page/admin-login-page').then((module) => module.AdminLoginPage),
    title: 'Connexion administration - Les Routes Oubliees',
  },
  {
    // Le guard n'est evalue qu'a l'entree de l'espace admin : la navigation
    // entre sections ne change que le parametre `:section`, donc l'instance
    // AdminShell est reutilisee (pas de re-verification de session ni de
    // re-chargement complet a chaque clic).
    path: '',
    canActivate: [adminAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: ':section', loadComponent: loadAdminShell, title: adminSectionTitle },
    ],
  },
];

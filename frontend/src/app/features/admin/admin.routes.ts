import { Routes } from '@angular/router';

import { adminAuthGuard } from '../../core/guards/admin-auth.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin-shell/admin-shell').then((module) => module.AdminShell),
    title: 'Administration - Les Routes Oubliées',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./admin-login-page/admin-login-page').then((module) => module.AdminLoginPage),
    title: 'Connexion administration - Les Routes Oubliées',
  },
];

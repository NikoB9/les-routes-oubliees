import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
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

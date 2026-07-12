import { Routes } from '@angular/router';

import { adminAuthGuard } from '../../core/guards/admin-auth.guard';

const loadAdminShell = () =>
  import('./admin-shell/admin-shell').then((module) => module.AdminShell);

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./admin-login-page/admin-login-page').then((module) => module.AdminLoginPage),
    title: 'Connexion administration - Les Routes Oubliees',
  },
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Administration - Les Routes Oubliees',
  },
  {
    path: 'home',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Accueil admin - Les Routes Oubliees',
  },
  {
    path: 'group',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Compagnie admin - Les Routes Oubliees',
  },
  {
    path: 'adventurers',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Aventuriers admin - Les Routes Oubliees',
  },
  {
    path: 'map',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Carte admin - Les Routes Oubliees',
  },
  {
    path: 'notebook',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Quetes admin - Les Routes Oubliees',
  },
  {
    path: 'media',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Medias admin - Les Routes Oubliees',
  },
  {
    path: 'administrators',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Administrateurs - Les Routes Oubliees',
  },
  {
    path: 'audit',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Audit admin - Les Routes Oubliees',
  },
  {
    path: 'settings',
    canActivate: [adminAuthGuard],
    loadComponent: loadAdminShell,
    title: 'Parametres admin - Les Routes Oubliees',
  },
];

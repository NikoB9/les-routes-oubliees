import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home-page/home-page').then((module) => module.HomePage),
    title: 'Accueil - Les Routes Oubliées',
  },
  {
    path: 'map',
    loadComponent: () => import('./features/map/map-page/map-page').then((module) => module.MapPage),
    title: 'Carte - Les Routes Oubliées',
  },
  {
    path: 'notebook',
    loadComponent: () =>
      import('./features/notebook/notebook-page/notebook-page').then(
        (module) => module.NotebookPage,
      ),
    title: 'Carnet - Les Routes Oubliées',
  },
  {
    path: 'notebook/:questCode',
    loadComponent: () =>
      import('./features/notebook/notebook-page/notebook-page').then(
        (module) => module.NotebookPage,
      ),
    title: 'Quête - Les Routes Oubliées',
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((module) => module.adminRoutes),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found-page/not-found-page').then(
        (module) => module.NotFoundPage,
      ),
    title: 'Page introuvable - Les Routes Oubliées',
  },
];

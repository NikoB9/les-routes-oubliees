import { IsActiveMatchOptions } from '@angular/router';

export interface PublicNavLink {
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly exact: boolean;
  readonly icon: 'home' | 'map' | 'notebook' | 'radar';
}

export const exactRouteMatch: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

export const sectionRouteMatch: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  matrixParams: 'ignored',
  fragment: 'ignored',
};

export const publicNavLinks: readonly PublicNavLink[] = [
  {
    label: 'Accueil',
    description: 'Le présage actuel et la Compagnie',
    path: '/',
    exact: true,
    icon: 'home',
  },
  {
    label: 'Carte',
    description: 'Les terres où avance la Compagnie',
    path: '/map',
    exact: false,
    icon: 'map',
  },
  {
    label: 'Carnet',
    description: 'Nouvelles et secrets des quêtes',
    path: '/notebook',
    exact: false,
    icon: 'notebook',
  },
  {
    label: 'Radar',
    description: 'Les échos vivants de la Compagnie',
    path: '/radar',
    exact: false,
    icon: 'radar',
  },
];

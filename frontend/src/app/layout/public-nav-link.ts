import { IsActiveMatchOptions } from '@angular/router';

export interface PublicNavLink {
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly exact: boolean;
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
    description: 'Message actuel et compagnie',
    path: '/',
    exact: true,
  },
  {
    label: 'Carte',
    description: "Progression de l'aventure",
    path: '/map',
    exact: false,
  },
  {
    label: 'Carnet',
    description: 'Quetes revelees',
    path: '/notebook',
    exact: false,
  },
];

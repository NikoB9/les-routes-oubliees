import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  PublicNavLink,
  exactRouteMatch,
  publicNavLinks,
  sectionRouteMatch,
} from '../public-nav-link';

@Component({
  selector: 'app-desktop-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './desktop-navigation.html',
  styleUrl: './desktop-navigation.css',
})
export class DesktopNavigationComponent {
  readonly labelledBy = input.required<string>();
  protected readonly links = publicNavLinks;

  protected routeMatch(link: PublicNavLink) {
    return link.exact ? exactRouteMatch : sectionRouteMatch;
  }
}

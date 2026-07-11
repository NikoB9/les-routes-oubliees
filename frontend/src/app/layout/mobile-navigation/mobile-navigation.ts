import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  PublicNavLink,
  exactRouteMatch,
  publicNavLinks,
  sectionRouteMatch,
} from '../public-nav-link';

@Component({
  selector: 'app-mobile-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-navigation.html',
  styleUrl: './mobile-navigation.css',
})
export class MobileNavigationComponent {
  protected readonly links = publicNavLinks;

  protected routeMatch(link: PublicNavLink) {
    return link.exact ? exactRouteMatch : sectionRouteMatch;
  }
}

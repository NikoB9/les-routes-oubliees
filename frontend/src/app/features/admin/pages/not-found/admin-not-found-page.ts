import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="admin-panel" aria-labelledby="admin-not-found-title">
      <h1 id="admin-not-found-title">Section d’administration indisponible</h1>
      <p>Cette rubrique n’existe pas ou n’est plus disponible.</p>
      <a routerLink="/admin/dashboard">Revenir au tableau de bord</a>
    </section>
  `,
  styles: `
    .admin-panel { max-width: 48rem; margin-top: 2rem; }
    a { color: #5c1717; font-weight: 800; }
  `,
})
export class AdminNotFoundPage {}

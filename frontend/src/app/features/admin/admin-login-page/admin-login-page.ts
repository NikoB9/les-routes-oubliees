import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-login-page',
  templateUrl: './admin-login-page.html',
  styleUrl: './admin-login-page.css',
})
export class AdminLoginPage {
  private readonly route = inject(ActivatedRoute);

  protected readonly accessDenied = computed(
    () => this.route.snapshot.queryParamMap.get('error') === 'access_denied',
  );
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CloudflareAccessSessionService {
  private readonly reauthKey = 'lro.cloudflare-reauth.v1';

  reauthenticate() {
    if (sessionStorage.getItem(this.reauthKey) === 'pending') {
      return;
    }
    sessionStorage.setItem(this.reauthKey, 'pending');
    window.location.assign(window.location.href);
  }

  clearPendingReauthentication() {
    sessionStorage.removeItem(this.reauthKey);
  }
}

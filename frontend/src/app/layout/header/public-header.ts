import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  templateUrl: './public-header.html',
  styleUrl: './public-header.css',
})
export class PublicHeaderComponent {
  private readonly requiredSealTouches = 3;
  private readonly sealTouches = signal(0);

  protected readonly adminGateRevealed = signal(false);

  protected revealAdminGate() {
    const nextTouches = this.sealTouches() + 1;
    this.sealTouches.set(nextTouches);

    if (nextTouches >= this.requiredSealTouches) {
      this.adminGateRevealed.set(true);
    }
  }
}

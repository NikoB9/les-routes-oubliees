import { Component, inject } from '@angular/core';

import { PwaInstallPromptService } from '../../../core/pwa/pwa-install-prompt.service';

@Component({
  selector: 'app-pwa-install-prompt',
  templateUrl: './pwa-install-prompt.html',
  styleUrl: './pwa-install-prompt.css',
})
export class PwaInstallPromptComponent {
  protected readonly prompt = inject(PwaInstallPromptService);
}

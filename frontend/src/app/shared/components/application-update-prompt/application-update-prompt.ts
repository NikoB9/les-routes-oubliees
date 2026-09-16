import { Component, inject } from '@angular/core';

import { ApplicationUpdateService } from '../../../core/pwa/application-update.service';

@Component({
  selector: 'app-application-update-prompt',
  templateUrl: './application-update-prompt.html',
  styleUrl: './application-update-prompt.css',
})
export class ApplicationUpdatePromptComponent {
  protected readonly update = inject(ApplicationUpdateService);
}

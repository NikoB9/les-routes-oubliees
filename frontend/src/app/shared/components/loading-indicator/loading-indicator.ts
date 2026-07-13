import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.html',
  styleUrl: './loading-indicator.css',
})
export class LoadingIndicatorComponent {
  readonly label = input.required<string>();
}

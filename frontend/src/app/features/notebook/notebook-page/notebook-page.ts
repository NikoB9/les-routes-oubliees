import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-notebook-page',
  templateUrl: './notebook-page.html',
  styleUrl: './notebook-page.css',
})
export class NotebookPage {
  private readonly route = inject(ActivatedRoute);

  protected readonly questCode = this.route.snapshot.paramMap.get('questCode');
}

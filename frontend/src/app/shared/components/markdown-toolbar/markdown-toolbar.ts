import { Component, output } from '@angular/core';

export interface MarkdownCommand {
  before: string;
  after: string;
  placeholder: string;
}

@Component({
  selector: 'app-markdown-toolbar',
  templateUrl: './markdown-toolbar.html',
  styleUrl: './markdown-toolbar.css',
})
export class MarkdownToolbarComponent {
  readonly markdownCommand = output<MarkdownCommand>();
  readonly linkRequested = output<void>();
  readonly imageRequested = output<Event>();

  protected emit(before: string, after: string, placeholder: string) {
    this.markdownCommand.emit({ before, after, placeholder });
  }
}

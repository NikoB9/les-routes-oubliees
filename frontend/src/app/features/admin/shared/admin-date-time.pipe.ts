import { Pipe, PipeTransform } from '@angular/core';

const FRENCH_DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

@Pipe({ name: 'adminDateTime' })
export class AdminDateTimePipe implements PipeTransform {
  transform(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : FRENCH_DATE_TIME.format(date);
  }
}

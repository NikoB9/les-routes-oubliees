import { Pipe, PipeTransform } from '@angular/core';

const ADMIN_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
  INFORMATION: 'Information',
  WARNING: 'Avertissement',
  QUEST_IMMINENT: 'Quête imminente',
  SUCCESS: 'Succès',
  MYSTERY: 'Mystère',
  ONLINE: 'En ligne',
  MAINTENANCE: 'Maintenance',
  UNASSIGNED: 'Non attribué',
  ADVENTURER: 'Aventurier',
  GUEST: 'Invité',
  TOP: 'Haut',
  BOTTOM: 'Bas',
  LEFT: 'Gauche',
  RIGHT: 'Droite',
};

@Pipe({ name: 'adminLabel' })
export class AdminLabelPipe implements PipeTransform {
  transform(value: string): string {
    return ADMIN_LABELS[value] ?? value;
  }
}

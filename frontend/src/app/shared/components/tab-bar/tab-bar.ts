import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Barre d'onglets à défilement horizontal.
 *
 * Projette une liste d'onglets (`<ul>`) et la maintient sur une seule ligne :
 * quand elle deborde, deux fleches apparaissent pour faire defiler, et se
 * désactivent en bout de course. Aucune dépendance externe.
 */
@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css',
})
export class TabBarComponent implements AfterViewInit, OnDestroy {
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');

  protected readonly overflowing = signal(false);
  protected readonly canScrollPrev = signal(false);
  protected readonly canScrollNext = signal(false);

  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const element = this.viewport().nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(element);
    // Observe aussi le contenu projeté : les onglets arrivent souvent après
    // le premier rendu (chargement asynchrone des données).
    const content = element.firstElementChild;
    if (content) {
      this.resizeObserver.observe(content);
    }
    this.update();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  protected update(): void {
    const element = this.viewport().nativeElement;
    const maxScroll = element.scrollWidth - element.clientWidth;
    this.overflowing.set(maxScroll > 1);
    this.canScrollPrev.set(element.scrollLeft > 1);
    this.canScrollNext.set(element.scrollLeft < maxScroll - 1);
  }

  protected scrollByStep(direction: -1 | 1): void {
    const element = this.viewport().nativeElement;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }
}

import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subscription, catchError, finalize, interval, switchMap, timer } from 'rxjs';

import { PortalIdentityStore } from '../../../core/portal/portal-identity.store';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator';
import { RadarApiService } from '../radar-api.service';
import { RadarLocationPayload, RadarParticipant, RadarPoint, RadarSnapshot, RadarStreamEvent } from '../radar.models';

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;
type LeafletCircle = import('leaflet').Circle;
type LeafletLayerGroup = import('leaflet').LayerGroup;

@Component({
  selector: 'app-radar-page',
  imports: [DatePipe, DecimalPipe, LoadingIndicatorComponent],
  templateUrl: './radar-page.html',
  styleUrl: './radar-page.css',
})
export class RadarPage implements OnDestroy {
  protected readonly portalStore = inject(PortalIdentityStore);
  private readonly radarApi = inject(RadarApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');

  protected readonly snapshot = signal<RadarSnapshot | null>(null);
  protected readonly locationState = signal<'idle' | 'waiting' | 'ready' | 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'error'>('idle');
  // Deux causes distinctes, donc deux signaux : ne plus recevoir l'état des autres n'est pas
  // la même chose que ne plus leur transmettre le sien.
  protected readonly streamError = signal(false);
  protected readonly publishError = signal(false);
  // Troisième cause distincte : la carte peut manquer alors que le flux et la publication
  // fonctionnent. La liste des positions ne dépend pas de Leaflet, le Radar reste utilisable.
  protected readonly mapUnavailable = signal(false);
  protected readonly selectedParticipant = signal<RadarParticipant | null>(null);

  protected readonly portal = computed(() => this.portalStore.portal());
  protected readonly portalLoading = computed(() => this.portalStore.loading() || !this.portalStore.loaded());
  protected readonly portalError = computed(() => this.portalStore.error());
  protected readonly needsAssignment = computed(() => this.portalStore.needsAssignment());
  protected readonly assigned = computed(() => {
    const mode = this.portalStore.identity()?.accessMode;
    return mode === 'ADVENTURER' || mode === 'GUEST';
  });

  private leaflet: LeafletModule | null = null;
  private map: LeafletMap | null = null;
  private participantMarkers = new Map<string, LeafletMarker>();
  private participantCircles = new Map<string, LeafletCircle>();
  private pointMarkers = new Map<string, LeafletMarker>();
  /** Apparence déjà posée sur chaque repère, pour ne le reconstruire que si elle change. */
  private participantAppearances = new Map<string, string>();
  private treasureMarker: LeafletMarker | null = null;
  private treasureCircle: LeafletCircle | null = null;
  private layerGroup: LeafletLayerGroup | null = null;
  private watchId: number | null = null;
  private locationInterval: ReturnType<typeof window.setInterval> | null = null;
  private lastLocation: RadarLocationPayload | null = null;
  private locationPublishSubscription: Subscription | null = null;
  private streamSubscription: Subscription | null = null;
  private streamRetry: Subscription | null = null;
  private fallbackPolling: Subscription | null = null;
  private mapInitializing = false;
  private streamActive = false;
  private locationPublishInFlight = false;
  private locationPublishPending = false;
  private locationPublished = false;
  private destroyed = false;
  private snapshotLoaded = false;

  constructor() {
    this.portalStore.load();
    effect(() => {
      if (this.assigned() && !this.snapshotLoaded) {
        this.snapshotLoaded = true;
        this.loadSnapshot();
      }
    });
  }

  /**
   * La géolocalisation, la publication et le flux SSE n'existent que pendant l'affichage
   * du Radar. L'état détruit est positionné en premier afin qu'aucun callback tardif,
   * timer ou `finalize()` ne puisse déclencher une nouvelle publication.
   */
  ngOnDestroy() {
    this.destroyed = true;
    this.stopLocationInterval();
    this.stopLocationWatch();
    this.cancelPublications();
    this.stopFallbackPolling();
    this.stopStreamRetry();
    this.lastLocation = null;
    this.map?.remove();
    this.map = null;
    this.announceDepartureOnce();
  }

  protected loadPortal() {
    this.portalStore.load(true);
  }

  protected requestLocation() {
    if (this.destroyed) {
      return;
    }
    if (!window.isSecureContext) {
      this.locationState.set('insecure');
      return;
    }
    if (!('geolocation' in navigator)) {
      this.locationState.set('unavailable');
      return;
    }
    this.locationState.set('waiting');
    this.watchId = navigator.geolocation.watchPosition(
      (position) => void this.handlePosition(position),
      (error) => this.handleLocationError(error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  protected retryLocation() {
    this.stopLocationWatch();
    this.requestLocation();
  }

  protected focusParticipant(participant: RadarParticipant) {
    this.selectedParticipant.set(participant);
    this.map?.setView([participant.latitude, participant.longitude], Math.max(this.map.getZoom(), 16));
    this.participantMarkers.get(participant.identityId)?.openPopup();
  }

  protected focusPoint(point: RadarPoint) {
    this.map?.setView([point.latitude, point.longitude], Math.max(this.map.getZoom(), 16));
    this.pointMarkers.get(point.id)?.openPopup();
  }

  protected recenter() {
    if (this.lastLocation && this.map) {
      this.map.setView([this.lastLocation.latitude, this.lastLocation.longitude], Math.max(this.map.getZoom(), 16));
    }
  }

  protected fitCompany() {
    if (!this.leaflet || !this.map) {
      return;
    }
    const points = this.snapshot()?.participants.map((participant) => [participant.latitude, participant.longitude] as [number, number]) ?? [];
    const treasure = this.snapshot()?.treasure;
    if (treasure) {
      points.push([treasure.latitude, treasure.longitude]);
    }
    for (const point of this.snapshot()?.points ?? []) {
      points.push([point.latitude, point.longitude]);
    }
    if (points.length > 0) {
      this.map.fitBounds(this.leaflet.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    }
  }

  private loadSnapshot() {
    this.radarApi
      .snapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (snapshot) => this.applySnapshot(snapshot),
        // Le premier état manquant est déjà une réception dégradée : le sondage s'en charge,
        // et s'arrête de lui-même dès que le flux direct délivre son premier événement.
        error: () => this.startFallbackPolling(),
      });
  }

  /**
   * Ouvre le flux direct, une seule fois.
   *
   * Le garde repose sur un drapeau et non sur `streamSubscription` : un observable qui
   * échoue de façon synchrone exécute son rappel d'erreur *avant* que `subscribe()` n'ait
   * retourné, donc avant l'affectation. Un garde fondé sur la souscription serait alors
   * réarmé par cette affectation tardive et bloquerait définitivement la reprise programmée.
   *
   * Aucun rappel `complete` : le flux `EventSource` ne se termine jamais de lui-même, il ne
   * fait qu'échouer ou être démonté à la destruction.
   */
  private startEvents() {
    if (this.streamActive || this.destroyed) {
      return;
    }
    this.streamActive = true;
    this.streamSubscription = this.radarApi
      .events()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.handleStreamEvent(event),
        // Coupure définitive : le navigateur ne réessaiera pas. Le sondage prend le relais et
        // une reprise est armée, sans quoi la session entière resterait en mode dégradé — le
        // défaut même que la reconnexion native vient de supprimer.
        error: () => {
          this.streamActive = false;
          this.startFallbackPolling();
          this.scheduleStreamRetry();
        },
      });
  }

  /**
   * Réarme le flux direct une minute après une coupure définitive.
   *
   * Le garde `destroyed` couvre la destruction en cours, pendant laquelle `DestroyRef` n'est
   * pas encore marqué détruit : `takeUntilDestroyed` ne coupe alors rien, et une reprise
   * serait armée sur un composant qui s'en va.
   */
  private scheduleStreamRetry() {
    if (this.streamRetry || this.destroyed) {
      return;
    }
    this.streamRetry = timer(60000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.streamRetry = null;
        this.startEvents();
      });
  }

  private stopStreamRetry() {
    this.streamRetry?.unsubscribe();
    this.streamRetry = null;
  }

  private handleStreamEvent(event: RadarStreamEvent) {
    if (event.kind === 'reconnecting') {
      this.startFallbackPolling();
      return;
    }
    // Un événement reçu prouve que la liaison est rétablie : le repli n'a plus lieu d'être.
    this.stopFallbackPolling();
    this.streamError.set(false);
    if (event.kind === 'snapshot') {
      this.applySnapshot(event.snapshot);
    }
  }

  /**
   * Sondage de secours pendant que la liaison directe est interrompue.
   *
   * Un tirage en échec est absorbé sur place : sans cela il terminerait la souscription et
   * la page resterait figée jusqu'au retour du flux, alors que le sondage est justement le
   * filet censé couvrir cette période.
   */
  private startFallbackPolling() {
    this.streamError.set(true);
    if (this.fallbackPolling || this.destroyed) {
      return;
    }
    this.fallbackPolling = interval(10000)
      .pipe(
        switchMap(() => this.radarApi.snapshot().pipe(catchError(() => {
          this.streamError.set(true);
          return EMPTY;
        }))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((snapshot) => this.applySnapshot(snapshot));
  }

  private stopFallbackPolling() {
    this.fallbackPolling?.unsubscribe();
    this.fallbackPolling = null;
  }

  private async handlePosition(position: GeolocationPosition) {
    if (this.destroyed) {
      return;
    }
    const payload: RadarLocationPayload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      observedAt: new Date(position.timestamp).toISOString(),
    };
    this.lastLocation = payload;
    this.locationState.set('ready');
    // La réception des autres suit l'entrée effective dans le Radar, jamais le chargement de
    // la carte : adossée à `ensureMap`, elle disparaissait avec Leaflet, et la publication
    // avec elle puisqu'un import en échec interrompait cette méthode avant les deux appels
    // qui suivent.
    this.startEvents();
    await this.ensureMap(payload);
    this.startLocationInterval();
    this.sendLatestLocation();
  }

  private handleLocationError(error: GeolocationPositionError) {
    if (this.destroyed) {
      return;
    }
    this.stopLocationInterval();
    this.lastLocation = null;
    if (error.code === error.PERMISSION_DENIED) {
      this.stopLocationWatch();
      this.locationState.set('denied');
      // La permission est définitivement perdue : plus aucune position ne sera publiée. Le
      // repère doit donc disparaître tout de suite, au lieu d'attendre le TTL serveur.
      this.cancelPublications();
      this.announceDepartureOnce();
    }
    else if (error.code === error.POSITION_UNAVAILABLE) {
      this.locationState.set('unavailable');
    }
    else if (error.code === error.TIMEOUT) {
      this.locationState.set('timeout');
    }
    else {
      this.locationState.set('error');
    }
  }

  /**
   * Le drapeau est levé avant l'import et non après : deux relevés rapprochés franchiraient
   * sinon tous deux le garde pendant le chargement de Leaflet, et la seconde initialisation
   * échouerait sur un conteneur déjà pris. Il retombe dans tous les cas, de sorte qu'un relevé
   * ultérieur puisse réessayer si l'élément n'était pas encore rendu.
   *
   * L'échec est absorbé plutôt que propagé. Un chargement de Leaflet en échec — un fragment
   * périmé après un redéploiement, par exemple — interrompait sinon `handlePosition()` avant
   * le démarrage de la republication : l'aventurier se croyait présent alors qu'il ne
   * publiait plus rien et restait invisible des autres, sans le moindre message.
   */
  private async ensureMap(location: RadarLocationPayload) {
    if (this.map || this.mapInitializing || this.destroyed) {
      return;
    }
    this.mapInitializing = true;
    try {
      this.leaflet = await this.loadLeaflet();
      const element = this.mapElement()?.nativeElement;
      if (!element || !this.leaflet || this.destroyed) {
        return;
      }
      this.map = this.leaflet.map(element, { zoomControl: true }).setView([location.latitude, location.longitude], 16);
      this.leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.map);
      this.layerGroup = this.leaflet.layerGroup().addTo(this.map);
      this.mapUnavailable.set(false);
      this.renderSnapshot();
    }
    catch {
      this.mapUnavailable.set(true);
    }
    finally {
      this.mapInitializing = false;
    }
  }

  /**
   * Chargement paresseux de Leaflet, isolé pour être reproductible en test.
   *
   * Le défaut corrigé ici — un fragment périmé après un redéploiement qui emportait aussi la
   * publication de position — est invisible en exploitation : personne ne voit qu'il ne
   * publie plus. Un échec impossible à simuler est un échec qui revient.
   *
   * Le `default` est déballé parce que Leaflet 1.9.4 ne publie qu'un paquet UMD
   * (`main: dist/leaflet-src.js`, ni `module` ni `exports`). Ses `exports.map = …` sont
   * enfermés dans la fabrique UMD, donc invisibles à l'analyse statique du bundler : aucun
   * export nommé n'est synthétisé et l'espace de noms ne porte que `default`. `L.map` était
   * alors `undefined` et la carte échouait partout, en développement comme en production —
   * `@types/leaflet` promettant des exports nommés, la compilation ne disait rien. Le repli
   * sur l'espace de noms couvre un empaquetage qui exposerait un jour ces exports.
   */
  private async loadLeaflet(): Promise<LeafletModule> {
    const module = await import('leaflet');
    return (module as unknown as { default?: LeafletModule }).default ?? (module as unknown as LeafletModule);
  }

  private startLocationInterval() {
    if (this.locationInterval !== null || this.destroyed) {
      return;
    }
    // La dernière position connue est republiée toutes les sept secondes, même sans
    // nouveau relevé du navigateur : un aventurier immobile reste visible malgré le TTL
    // serveur de 45 secondes.
    this.locationInterval = window.setInterval(() => this.sendLatestLocation(), 7000);
  }

  private sendLatestLocation() {
    if (this.destroyed) {
      return;
    }
    if (!this.lastLocation || this.locationState() !== 'ready') {
      return;
    }
    if (this.locationPublishInFlight) {
      this.locationPublishPending = true;
      return;
    }
    const payload = this.lastLocation;
    this.locationPublishInFlight = true;
    this.locationPublishPending = false;
    this.locationPublished = true;
    this.locationPublishSubscription = this.radarApi
      .updateLocation(payload)
      .pipe(
        finalize(() => {
          this.locationPublishInFlight = false;
          this.locationPublishSubscription = null;
          const pending = this.locationPublishPending;
          this.locationPublishPending = false;
          // Un `finalize()` déclenché par la destruction ne doit jamais relancer une
          // publication : l'état détruit est vérifié avant tout nouvel envoi.
          if (pending && !this.destroyed) {
            this.sendLatestLocation();
          }
        }),
      )
      .subscribe({
        next: () => this.publishError.set(false),
        error: () => this.publishError.set(true),
      });
  }

  private applySnapshot(snapshot: RadarSnapshot) {
    this.snapshot.set(snapshot);
    this.renderSnapshot();
  }

  private renderSnapshot() {
    if (!this.leaflet || !this.map || !this.layerGroup) {
      return;
    }
    const snapshot = this.snapshot();
    if (!snapshot) {
      return;
    }
    const currentId = snapshot.currentIdentity?.identityId ?? this.portal()?.identity.id ?? null;
    const activeIds = new Set(snapshot.participants.map((participant) => participant.identityId));
    const activePointIds = new Set(snapshot.points.map((point) => point.id));
    for (const [id, marker] of this.participantMarkers) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.participantMarkers.delete(id);
        // Sans cet oubli, un participant qui revient garderait l'apparence de son repère
        // precedent : le repère serait recréé, mais jamais réhabillé.
        this.participantAppearances.delete(id);
      }
    }
    for (const [id, circle] of this.participantCircles) {
      if (!activeIds.has(id)) {
        circle.remove();
        this.participantCircles.delete(id);
      }
    }
    for (const participant of snapshot.participants) {
      this.renderParticipant(participant, participant.identityId === currentId);
    }
    for (const [id, marker] of this.pointMarkers) {
      if (!activePointIds.has(id)) {
        marker.remove();
        this.pointMarkers.delete(id);
      }
    }
    for (const point of snapshot.points) {
      this.renderPoint(point);
    }
    this.renderTreasure(snapshot);
  }

  /**
   * Le repère n'est reconstruit que si son apparence a changé.
   *
   * `setIcon` remplace l'élément DOM du repère : l'avatar `<img>` est donc recréé, et le
   * navigateur redemande l'image — au service worker, qui la sert depuis son cache, mais la
   * décode à chaque fois. Or le rendu rejoue *tous* les participants à chaque instantané, et
   * les instantanés arrivent au rythme des publications de position de toute la compagnie.
   * L'apparence, elle, ne dépend que de l'avatar et de deux drapeaux : elle est presque
   * toujours identique d'un instantané au suivant. Seules les coordonnées bougent, et
   * `setLatLng` déplace le repère sans le reconstruire.
   */
  private renderParticipant(participant: RadarParticipant, current: boolean) {
    if (!this.leaflet || !this.map) {
      return;
    }
    const className = `radar-avatar-marker${current ? ' current' : ''}${participant.stale ? ' stale' : ''}`;
    const html = this.markerHtml(participant);
    const appearance = `${className}|${html}`;
    const icon = this.leaflet.divIcon({ className, html, iconSize: [44, 44], iconAnchor: [22, 22] });
    const latLng: [number, number] = [participant.latitude, participant.longitude];
    const marker = this.participantMarkers.get(participant.identityId);
    if (marker) {
      marker.setLatLng(latLng).setPopupContent(this.participantPopup(participant));
      if (this.participantAppearances.get(participant.identityId) !== appearance) {
        this.participantAppearances.set(participant.identityId, appearance);
        marker.setIcon(icon);
      }
    }
    else {
      this.participantAppearances.set(participant.identityId, appearance);
      this.participantMarkers.set(
        participant.identityId,
        this.leaflet.marker(latLng, { icon }).bindPopup(this.participantPopup(participant)).addTo(this.map),
      );
    }
    const circle = this.participantCircles.get(participant.identityId);
    if (circle) {
      circle.setLatLng(latLng).setRadius(participant.accuracyM);
    }
    else {
      this.participantCircles.set(
        participant.identityId,
        this.leaflet.circle(latLng, { radius: participant.accuracyM, color: current ? '#1967d2' : '#6f5a34', fillOpacity: 0.08 }).addTo(this.map),
      );
    }
  }

  private renderTreasure(snapshot: RadarSnapshot) {
    if (!this.leaflet || !this.map) {
      return;
    }
    if (!snapshot.treasure) {
      this.treasureMarker?.remove();
      this.treasureCircle?.remove();
      this.treasureMarker = null;
      this.treasureCircle = null;
      return;
    }
    const latLng: [number, number] = [snapshot.treasure.latitude, snapshot.treasure.longitude];
    const icon = this.leaflet.divIcon({
      className: `radar-treasure-marker${snapshot.treasure.stale ? ' stale' : ''}`,
      html: '<span aria-hidden="true">◆</span>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    const popup = this.treasurePopup(snapshot.treasure);
    if (this.treasureMarker) {
      this.treasureMarker.setLatLng(latLng).setIcon(icon).setPopupContent(popup);
    }
    else {
      this.treasureMarker = this.leaflet.marker(latLng, { icon }).bindPopup(popup).addTo(this.map);
    }
    if (this.treasureCircle) {
      this.treasureCircle.setLatLng(latLng).setRadius(snapshot.treasure.accuracyM);
    }
    else {
      this.treasureCircle = this.leaflet.circle(latLng, { radius: snapshot.treasure.accuracyM, color: '#b8860b', fillOpacity: 0.12 }).addTo(this.map);
    }
  }

  private renderPoint(point: RadarPoint) {
    if (!this.leaflet || !this.map) {
      return;
    }
    const latLng: [number, number] = [point.latitude, point.longitude];
    const icon = this.leaflet.divIcon({
      className: 'radar-point-marker',
      html: '<span aria-hidden="true">!</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const popup = this.pointPopup(point);
    const marker = this.pointMarkers.get(point.id);
    if (marker) {
      marker.setLatLng(latLng).setIcon(icon).setPopupContent(popup);
    }
    else {
      this.pointMarkers.set(point.id, this.leaflet.marker(latLng, { icon }).bindPopup(popup).addTo(this.map));
    }
  }

  private markerHtml(participant: RadarParticipant) {
    if (participant.accessMode === 'GUEST') {
      return '<span class="ghost-marker" aria-hidden="true">?</span>';
    }
    if (participant.avatarPath) {
      return `<img src="${this.escapeAttribute(participant.avatarPath)}" alt="" />`;
    }
    return `<span>${this.initials(participant.displayName)}</span>`;
  }

  private participantPopup(participant: RadarParticipant): HTMLElement {
    const node = document.createElement('div');
    node.className = 'radar-popup';
    const lines = [
      participant.displayName,
      `Latitude: ${participant.latitude}`,
      `Longitude: ${participant.longitude}`,
      `Précision: ${participant.accuracyM} m`,
      `Relevé: ${participant.observedAt}`,
      participant.stale ? 'Position ancienne' : '',
    ].filter(Boolean);
    node.textContent = lines.join('\n');
    return node;
  }

  private treasurePopup(treasure: NonNullable<RadarSnapshot['treasure']>): HTMLElement {
    const node = document.createElement('div');
    node.className = 'radar-popup';
    node.textContent = [
      'Trésor',
      `Latitude: ${treasure.latitude}`,
      `Longitude: ${treasure.longitude}`,
      `Précision: ${treasure.accuracyM} m`,
      `Relevé: ${treasure.observedAt}`,
      treasure.stale ? 'Position ancienne' : '',
    ].filter(Boolean).join('\n');
    return node;
  }

  private pointPopup(point: RadarPoint): HTMLElement {
    const node = document.createElement('article');
    node.className = 'radar-popup radar-point-popup';

    const title = document.createElement('h3');
    title.textContent = point.title;
    node.append(title);

    if (point.imageUrl) {
      const image = document.createElement('img');
      image.src = point.imageUrl;
      image.alt = point.imageAltText || `Image associée au point ${point.title}`;
      node.append(image);
    }

    const description = document.createElement('p');
    description.textContent = point.description;
    node.append(description);

    const coordinates = document.createElement('p');
    coordinates.textContent = `Latitude: ${point.latitude}\nLongitude: ${point.longitude}`;
    node.append(coordinates);

    return node;
  }

  private initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('fr-FR') ?? '')
      .join('');
  }

  private escapeAttribute(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  /**
   * Interrompt la publication en cours et interdit toute publication différée.
   *
   * La position en vol est annulée côté client ; le serveur complète cette annulation par
   * une fenêtre de départ, une annulation navigateur ne garantissant pas qu'il n'a pas
   * déjà commencé à traiter la requête.
   */
  private cancelPublications() {
    this.locationPublishSubscription?.unsubscribe();
    this.locationPublishSubscription = null;
    this.locationPublishInFlight = false;
    this.locationPublishPending = false;
  }

  /** Annonce le départ une seule fois, et seulement si une position a été publiée. */
  private announceDepartureOnce() {
    if (!this.locationPublished) {
      return;
    }
    this.locationPublished = false;
    this.radarApi.announceDeparture();
  }

  private stopLocationWatch() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private stopLocationInterval() {
    if (this.locationInterval !== null) {
      window.clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }
}

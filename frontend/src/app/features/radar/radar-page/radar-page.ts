import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, interval, switchMap } from 'rxjs';

import { PortalIdentityStore } from '../../../core/portal/portal-identity.store';
import { LoadingIndicatorComponent } from '../../../shared/components/loading-indicator/loading-indicator';
import { RadarApiService } from '../radar-api.service';
import { RadarLocationPayload, RadarParticipant, RadarSnapshot } from '../radar.models';

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
  protected readonly streamError = signal(false);
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
  private treasureMarker: LeafletMarker | null = null;
  private treasureCircle: LeafletCircle | null = null;
  private layerGroup: LeafletLayerGroup | null = null;
  private watchId: number | null = null;
  private locationInterval: ReturnType<typeof window.setInterval> | null = null;
  private lastLocation: RadarLocationPayload | null = null;
  private locationPublishInFlight = false;
  private locationPublishPending = false;
  private readonly visibilityListener = () => this.sendLatestLocation();
  private snapshotLoaded = false;

  constructor() {
    this.portalStore.load();
    effect(() => {
      if (this.assigned() && !this.snapshotLoaded) {
        this.snapshotLoaded = true;
        this.loadSnapshot();
      }
    });
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.visibilityListener);
    this.stopLocationInterval();
    this.stopLocationWatch();
    this.map?.remove();
  }

  protected loadPortal() {
    this.portalStore.load(true);
  }

  protected requestLocation() {
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
    if (points.length > 0) {
      this.map.fitBounds(this.leaflet.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    }
  }

  private loadSnapshot() {
    this.radarApi.snapshot().subscribe({
      next: (snapshot) => this.applySnapshot(snapshot),
      error: () => this.streamError.set(true),
    });
  }

  private startEvents() {
    this.radarApi
      .events()
      .pipe(
        catchError(() => {
          this.streamError.set(true);
          return interval(10000).pipe(switchMap(() => this.radarApi.snapshot()));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((snapshot) => this.applySnapshot(snapshot));
  }

  private async handlePosition(position: GeolocationPosition) {
    const payload: RadarLocationPayload = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
      observedAt: new Date(position.timestamp).toISOString(),
    };
    this.lastLocation = payload;
    this.locationState.set('ready');
    await this.ensureMap(payload);
    this.startLocationInterval();
    this.sendLatestLocation();
  }

  private handleLocationError(error: GeolocationPositionError) {
    this.stopLocationInterval();
    this.lastLocation = null;
    if (error.code === error.PERMISSION_DENIED) {
      this.stopLocationWatch();
      this.locationState.set('denied');
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

  private async ensureMap(location: RadarLocationPayload) {
    if (this.map) {
      return;
    }
    this.leaflet = await import('leaflet');
    const element = this.mapElement()?.nativeElement;
    if (!element || !this.leaflet) {
      return;
    }
    this.map = this.leaflet.map(element, { zoomControl: true }).setView([location.latitude, location.longitude], 16);
    this.leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.layerGroup = this.leaflet.layerGroup().addTo(this.map);
    this.startEvents();
    this.renderSnapshot();
  }

  private startLocationInterval() {
    if (this.locationInterval !== null) {
      return;
    }
    this.locationInterval = window.setInterval(() => this.sendLatestLocation(), 7000);
  }

  private sendLatestLocation() {
    if (document.visibilityState !== 'visible') {
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
    this.radarApi
      .updateLocation(payload)
      .pipe(
        finalize(() => {
          this.locationPublishInFlight = false;
          if (this.locationPublishPending) {
            this.locationPublishPending = false;
            this.sendLatestLocation();
          }
        }),
      )
      .subscribe({ error: () => this.streamError.set(true) });
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
    for (const [id, marker] of this.participantMarkers) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.participantMarkers.delete(id);
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
    this.renderTreasure(snapshot);
  }

  private renderParticipant(participant: RadarParticipant, current: boolean) {
    if (!this.leaflet || !this.map) {
      return;
    }
    const icon = this.leaflet.divIcon({
      className: `radar-avatar-marker${current ? ' current' : ''}${participant.stale ? ' stale' : ''}`,
      html: this.markerHtml(participant),
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    const latLng: [number, number] = [participant.latitude, participant.longitude];
    const marker = this.participantMarkers.get(participant.identityId);
    if (marker) {
      marker.setLatLng(latLng).setIcon(icon).setPopupContent(this.participantPopup(participant));
    }
    else {
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

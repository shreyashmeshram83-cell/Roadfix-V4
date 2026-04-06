import React, { useEffect, useMemo, useRef } from 'react';
import maplibregl, { GeoJSONSource, LngLatBounds } from 'maplibre-gl';
import { PotholeReport, ReportStatus } from '../types';
import { normalizeLocation } from '../utils/location';

interface ReportsMapProps {
  reports: PotholeReport[];
  className?: string;
}

interface AreaSummary {
  city: string;
  state: string;
  country: string;
}

interface MapFeatureProperties {
  id: string;
  title: string;
  description: string;
  address: string;
  shortAddress: string;
  status: ReportStatus;
  statusColor: string;
  upvotes: number;
  user: string;
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';
const SOURCE_ID = 'roadfix-reports';
const CLUSTERS_ID = 'roadfix-report-clusters';
const CLUSTER_COUNT_ID = 'roadfix-report-cluster-count';
const POINTS_ID = 'roadfix-report-points';
const POINT_LABELS_ID = 'roadfix-report-point-labels';

const getStatusColor = (status: ReportStatus) => {
  switch (status) {
    case ReportStatus.RESOLVED:
      return '#16a34a';
    case ReportStatus.IN_PROGRESS:
      return '#ea580c';
    case ReportStatus.VERIFIED:
      return '#2563eb';
    case ReportStatus.PENDING:
    default:
      return '#dc2626';
  }
};

export const ReportsMap: React.FC<ReportsMapProps> = ({ reports, className }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const initializedRef = useRef(false);
  const styleFallbackRef = useRef(false);
  const geocodeTimerRef = useRef<number | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);

  const geoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, MapFeatureProperties>>(() => ({
    type: 'FeatureCollection' as const,
    features: reports
      .map((report) => {
        const location = normalizeLocation(report.location);
        if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [location.longitude, location.latitude]
          },
          properties: {
            id: report.id,
            title: report.title || 'Untitled report',
            description: report.description,
            address: location.address || 'Unknown location',
            shortAddress: (location.address || 'Unknown location').split(',').slice(0, 2).join(', '),
            status: report.status,
            statusColor: getStatusColor(report.status),
            upvotes: report.upvotes,
            user: report.user
          }
        };
      })
      .filter((feature): feature is GeoJSON.Feature<GeoJSON.Point, MapFeatureProperties> => feature !== null)
  }), [reports]);

  const counts = useMemo(() => ({
    pending: reports.filter((report) => report.status === ReportStatus.PENDING).length,
    inProgress: reports.filter((report) => report.status === ReportStatus.IN_PROGRESS).length,
    resolved: reports.filter((report) => report.status === ReportStatus.RESOLVED).length
  }), [reports]);

  const zoomToReports = (targetReports: PotholeReport[]) => {
    const map = mapRef.current;
    if (!map || !targetReports.length) return;

    const bounds = new LngLatBounds();
    targetReports.forEach((report) => {
      const location = normalizeLocation(report.location);
      if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        bounds.extend([location.longitude, location.latitude]);
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 72,
        maxZoom: 14,
        duration: 900
      });
    }
  };

  const updateAreaSummary = (summary: Partial<AreaSummary> | null, loading = false) => {
    if (!areaRef.current) return;

    if (loading) {
      areaRef.current.innerHTML = `
        <div class="roadfix-map-kicker">Live area</div>
        <div class="roadfix-map-meta-grid">
          <div class="roadfix-map-meta-pill">
            <span class="roadfix-map-meta-label">City</span>
            <span class="roadfix-map-meta-value">Loading...</span>
          </div>
          <div class="roadfix-map-meta-pill">
            <span class="roadfix-map-meta-label">State</span>
            <span class="roadfix-map-meta-value">Loading...</span>
          </div>
          <div class="roadfix-map-meta-pill">
            <span class="roadfix-map-meta-label">Country</span>
            <span class="roadfix-map-meta-value">Loading...</span>
          </div>
        </div>
      `;
      return;
    }

    const city = summary?.city || 'Unknown city';
    const state = summary?.state || 'Unknown state';
    const country = summary?.country || 'India';

    areaRef.current.innerHTML = `
      <div class="roadfix-map-kicker">Live area</div>
      <div class="roadfix-map-meta-grid">
        <div class="roadfix-map-meta-pill">
          <span class="roadfix-map-meta-label">City</span>
          <span class="roadfix-map-meta-value">${city}</span>
        </div>
        <div class="roadfix-map-meta-pill">
          <span class="roadfix-map-meta-label">State</span>
          <span class="roadfix-map-meta-value">${state}</span>
        </div>
        <div class="roadfix-map-meta-pill">
          <span class="roadfix-map-meta-label">Country</span>
          <span class="roadfix-map-meta-value">${country}</span>
        </div>
      </div>
    `;
  };

  const updateMapStatus = (message: string) => {
    if (statusRef.current) {
      statusRef.current.textContent = message;
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [78.9629, 20.5937],
      zoom: 4.5
    });

    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: 'roadfix-map-popup'
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    geolocateRef.current = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: false,
      showUserLocation: true,
      showAccuracyCircle: false
    });
    map.addControl(geolocateRef.current, 'top-right');
    updateAreaSummary(null, true);
    updateMapStatus('Liberty basemap active');

    const bindLayers = () => {
      if (map.getSource(SOURCE_ID)) {
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        source.setData(geoJson);
        return;
      }

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geoJson,
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 13
      });

      map.addLayer({
        id: CLUSTERS_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#1d4ed8',
            8,
            '#ea580c',
            20,
            '#b91c1c'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            8,
            24,
            20,
            30
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: CLUSTER_COUNT_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      map.addLayer({
        id: POINTS_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['coalesce', ['get', 'statusColor'], '#dc2626'],
          'circle-radius': 9,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addLayer({
        id: POINT_LABELS_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['coalesce', ['get', 'shortAddress'], ['get', 'title']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.7],
          'text-anchor': 'top',
          'text-max-width': 14,
          'text-optional': true,
          'symbol-sort-key': ['get', 'upvotes']
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.6,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            0,
            10,
            0.85,
            12,
            1
          ]
        }
      });

      map.on('click', CLUSTERS_ID, async (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: [CLUSTERS_ID] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId === undefined) return;

        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coordinates = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        map.easeTo({
          center: coordinates,
          zoom
        });
      });

      map.on('click', POINTS_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature || !popupRef.current) return;

        const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const { title, description, address, status, upvotes, user } = feature.properties as Record<string, string>;

        popupRef.current
          .setLngLat(coordinates)
          .setHTML(
            `<div class="space-y-1">
              <div class="roadfix-popup-title">${title}</div>
              <div class="roadfix-popup-meta">${address}</div>
              <div class="roadfix-popup-copy">${description}</div>
              <div class="roadfix-popup-footer">${status} · ${upvotes} votes · ${user}</div>
            </div>`
          )
          .addTo(map);
      });

      map.on('mouseenter', CLUSTERS_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', CLUSTERS_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', POINTS_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', POINTS_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', POINT_LABELS_ID, (event) => {
        const labelFeatures = map.queryRenderedFeatures(event.point, { layers: [POINT_LABELS_ID] });
        const feature = labelFeatures[0];
        if (!feature) return;

        const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        map.easeTo({
          center: coordinates,
          zoom: Math.max(map.getZoom(), 12),
          duration: 500
        });
      });

      map.on('mouseenter', POINT_LABELS_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', POINT_LABELS_ID, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    const ensureLayers = () => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      bindLayers();
    };

    const fallbackToDemoStyle = () => {
      if (styleFallbackRef.current) return;
      styleFallbackRef.current = true;
      initializedRef.current = false;
      updateMapStatus('Fallback basemap active');
      map.setStyle(FALLBACK_STYLE);
    };

    map.on('load', ensureLayers);
    map.on('style.load', ensureLayers);

    map.on('error', (event) => {
      const errorMessage = String((event as { error?: { message?: string } }).error?.message || '');
      if (
        !styleFallbackRef.current &&
        (errorMessage.includes('tiles.openfreemap.org') || errorMessage.includes('liberty'))
      ) {
        fallbackToDemoStyle();
      }
    });

    const fetchAreaForCenter = async () => {
      const center = map.getCenter();
      updateAreaSummary(null, true);

      geocodeAbortRef.current?.abort();
      const controller = new AbortController();
      geocodeAbortRef.current = controller;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${center.lat}&lon=${center.lng}&zoom=10&addressdetails=1`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Reverse geocoding failed');
        }

        const data = await response.json();
        const address = data.address || {};

        updateAreaSummary({
          city: address.city || address.town || address.county || address.state_district || 'Unknown city',
          state: address.state || address.region || 'Unknown state',
          country: address.country || 'India'
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          updateAreaSummary({
            city: 'Location unavailable',
            state: 'Move map to retry',
            country: 'OpenStreetMap reverse geocoder'
          });
        }
      }
    };

    const scheduleAreaFetch = () => {
      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }

      geocodeTimerRef.current = window.setTimeout(() => {
        void fetchAreaForCenter();
      }, 350);
    };

    map.on('load', scheduleAreaFetch);
    map.on('moveend', scheduleAreaFetch);

    return () => {
      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }
      geocodeAbortRef.current?.abort();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
      geolocateRef.current = null;
      initializedRef.current = false;
      styleFallbackRef.current = false;
    };
  }, [geoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateData = () => {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(geoJson);
      }

      if (!geoJson.features.length) return;

      const bounds = new LngLatBounds();
      geoJson.features.forEach((feature) => {
        bounds.extend(feature.geometry.coordinates as [number, number]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 56,
          maxZoom: 14,
          duration: 800
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateData();
    } else {
      map.once('load', updateData);
      map.once('style.load', updateData);
    }
  }, [geoJson]);

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div
          ref={areaRef}
          className="max-w-sm rounded-3xl border border-white/70 bg-white/88 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => geolocateRef.current?.trigger()}
            className="pointer-events-auto rounded-full border border-white/70 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-xl transition hover:bg-white"
            title="Recenter to my location"
            aria-label="Recenter to my location"
          >
            My location
          </button>
          <div className="rounded-full border border-white/70 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-white shadow-lg">
            {reports.length} reports mapped
          </div>
          <button
            type="button"
            onClick={() => zoomToReports(reports)}
            className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-xl transition hover:bg-white"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => zoomToReports(reports.filter((report) => report.status === ReportStatus.PENDING))}
            className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-xl transition hover:bg-white"
          >
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
            {counts.pending} pending
          </button>
          <button
            type="button"
            onClick={() => zoomToReports(reports.filter((report) => report.status === ReportStatus.IN_PROGRESS))}
            className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-xl transition hover:bg-white"
          >
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-orange-600" />
            {counts.inProgress} in progress
          </button>
          <button
            type="button"
            onClick={() => zoomToReports(reports.filter((report) => report.status === ReportStatus.RESOLVED))}
            className="pointer-events-auto rounded-full border border-white/70 bg-white/88 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-xl transition hover:bg-white"
          >
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
            {counts.resolved} resolved
          </button>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="h-full w-full rounded-[24px]"
      />

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-end justify-between">
        <div className="rounded-2xl border border-white/70 bg-white/88 px-4 py-3 text-xs text-slate-600 shadow-[0_16px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          Drag to explore different cities and states. Click a marker to inspect a report.
        </div>
        <div
          ref={statusRef}
          className="rounded-full border border-white/70 bg-slate-950/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-lg"
        />
      </div>
    </div>
  );
};

"use client";

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function MapboxMap({ lat, lng, isOnline = true }: { lat: number; lng: number; isOnline?: boolean }) {
    const position = { latitude: lat, longitude: lng };
    const leafletDoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; margin: 0; }
      body { background: #f1f5f9; }
      .leaflet-control-attribution {
        font: 10px/1.3 system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 16);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);
      L.marker([${lat}, ${lng}]).addTo(map);
    </script>
  </body>
</html>`;

    if (!isOnline || !MAPBOX_TOKEN) {
        return (
            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 relative">
                <iframe
                    title="Location Preview"
                    srcDoc={leafletDoc}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-3 py-2 shadow-sm">
                    <a
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 whitespace-nowrap"
                    >
                        Open Map
                    </a>
                    <code className="text-[10px] font-mono text-slate-600 dark:text-zinc-400 truncate">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                    </code>
                </div>
            </div>
        );
    }

    return (
        <div className="map-container shadow-inner border border-slate-200 dark:border-zinc-800 h-full w-full relative">
            <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    ...position,
                    zoom: 15
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/light-v11"
            >
                <Marker longitude={lng} latitude={lat} color="#3b82f6" />
            </Map>
        </div>
    );
}

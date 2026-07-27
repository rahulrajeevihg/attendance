"use client";

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Crosshair } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function MapboxMap({ lat, lng, isOnline = true }: { lat: number; lng: number; isOnline?: boolean }) {
    const position = { latitude: lat, longitude: lng };
    const delta = 0.005;
    const bbox = [
        lng - delta,
        lat - delta,
        lng + delta,
        lat + delta,
    ].join("%2C");

    if (!isOnline || !MAPBOX_TOKEN) {
        return (
            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 relative">
                <iframe
                    title="OpenStreetMap Location Preview"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                        <Crosshair className="w-4 h-4 text-green-500 shrink-0" />
                        <code className="text-[10px] font-mono text-slate-600 dark:text-zinc-400 truncate">
                            {lat.toFixed(6)}, {lng.toFixed(6)}
                        </code>
                    </div>
                    <a
                        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 whitespace-nowrap"
                    >
                        Open
                    </a>
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

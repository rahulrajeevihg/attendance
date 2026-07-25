"use client";

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Crosshair } from 'lucide-react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function MapboxMap({ lat, lng, isOnline = true }: { lat: number; lng: number; isOnline?: boolean }) {
    const position = { latitude: lat, longitude: lng };

    if (!isOnline || !MAPBOX_TOKEN) {
        return (
            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                    GPS Coordinates
                </p>
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <Crosshair className="w-4 h-4 text-green-500 animate-spin-slow" />
                    <code className="text-[10px] font-mono text-slate-600 dark:text-zinc-400">
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

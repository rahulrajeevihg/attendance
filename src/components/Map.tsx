"use client";

import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicmFodWxyYWplZXYzMTIiLCJhIjoiY21rODdtMjBwMTdqZTNjcjVlZDQwZnBlaSJ9.3uKDZg_IkLtHrKoELv7w0Q'; // Replace with actual Mapbox token

import { WifiOff, Crosshair } from 'lucide-react';

export default function MapboxMap({ lat, lng, isOnline = true }: { lat: number; lng: number; isOnline?: boolean }) {
    const position = { latitude: lat, longitude: lng };

    if (!isOnline) {
        return (
            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-200 dark:bg-zinc-700 rounded-full flex items-center justify-center animate-pulse">
                    <WifiOff className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-700 dark:text-zinc-200">Offline Mode</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-[200px] mx-auto">
                        Map tiles unavailable. GPS is still capturing your location accurately.
                    </p>
                </div>
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

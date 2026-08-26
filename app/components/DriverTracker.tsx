"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Location = {
  lat: number;
  lng: number;
};

export default function DriverTracker() {
  const [online, setOnline] = useState(false);

  const [location, setLocation] = useState<Location | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!online) {
      return;
    }

    if (!navigator.geolocation) {
      setError("Browser tidak mendukung GPS.");

      return;
    }

    let watchId: number;

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;

        const lng = position.coords.longitude;

        setLocation({
          lat,
          lng,
        });

        const { error: databaseError } = await supabase
          .from("driver_locations")
          .upsert({
            id: "main-driver",
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString(),
          });

        if (databaseError) {
          console.error(databaseError);
        }
      },
      (positionError) => {
        setError(positionError.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [online]);

  const toggleOnline = () => {
    setError("");

    setOnline((current) => !current);
  };

  return (
    <div className="bg-white rounded-3xl border shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Status Driver</p>

          <h2 className="text-2xl font-black">
            {online ? "🟢 ON-BID" : "⚫ OFFLINE"}
          </h2>
        </div>

        <button
          onClick={toggleOnline}
          className={`px-6 py-3 rounded-2xl font-black text-white ${
            online ? "bg-red-500" : "bg-green-600"
          }`}
        >
          {online ? "OFF-BID" : "ON-BID"}
        </button>
      </div>

      {location && online && (
        <div className="mt-5 bg-green-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-700">
            📍 Lokasi sedang dibagikan
          </p>

          <p className="text-xs text-green-600 mt-1">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 bg-red-50 text-red-600 rounded-2xl p-4 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

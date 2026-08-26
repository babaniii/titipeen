"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type Location = {
  lat: number;
  lng: number;
};

type Props = {
  onLocationUpdate?: (location: Location) => void;
};

export default function DriverTracker({ onLocationUpdate }: Props) {
  const [online, setOnline] = useState(false);

  const [location, setLocation] = useState<Location | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    // Kalau OFF-BID, hentikan tracking GPS
    if (!online) {
      return;
    }

    // Cek dukungan GPS browser
    if (!navigator.geolocation) {
      setError("Browser ini tidak mendukung GPS.");

      return;
    }

    setError("");

    /*
     * Mulai tracking GPS
     */
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;

        const lng = position.coords.longitude;

        const newLocation = {
          lat,
          lng,
        };

        /*
         * 1. Update lokasi di halaman driver
         */
        setLocation(newLocation);

        /*
         * 2. Kirim lokasi ke Map
         */
        if (onLocationUpdate) {
          onLocationUpdate(newLocation);
        }

        /*
         * 3. Simpan lokasi ke Supabase
         */
        try {
          const { error: dbError } = await supabase
            .from("driver_locations")
            .upsert(
              {
                id: "main-driver",

                latitude: lat,

                longitude: lng,

                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "id",
              },
            );

          if (dbError) {
            console.error("Supabase error:", dbError);

            setError("GPS aktif, tetapi lokasi gagal disimpan ke server.");
          } else {
            setError("");
          }
        } catch (error) {
          console.error("Database error:", error);

          setError("Terjadi kesalahan saat menyimpan lokasi.");
        }
      },

      /*
       * Kalau GPS error
       */
      (positionError) => {
        console.error("GPS error:", positionError);

        setError("GPS gagal: " + positionError.message);
      },

      /*
       * GPS options
       */
      {
        enableHighAccuracy: true,

        maximumAge: 2000,

        timeout: 15000,
      },
    );

    /*
     * Cleanup ketika OFF-BID
     */
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [online, onLocationUpdate]);

  /*
   * Tombol ON-BID / OFF-BID
   */
  const toggleOnline = () => {
    setError("");

    setOnline((current) => !current);
  };

  return (
    <div className="bg-white rounded-3xl border shadow-sm p-6">
      {/* STATUS */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Status Driver</p>

          <h2 className="text-2xl font-black">
            {online ? "🟢 ON-BID" : "⚫ OFFLINE"}
          </h2>
        </div>

        <button
          onClick={toggleOnline}
          className={`px-6 py-3 rounded-2xl font-black text-white ${
            online
              ? "bg-red-500 hover:bg-red-600"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {online ? "OFF-BID" : "ON-BID"}
        </button>
      </div>

      {/* LOKASI */}
      {location && online && (
        <div className="mt-5 bg-green-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-700">📍 GPS aktif</p>

          <p className="text-xs text-green-600 mt-1">
            Latitude: {location.lat.toFixed(6)}
          </p>

          <p className="text-xs text-green-600">
            Longitude: {location.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mt-4 bg-red-50 text-red-600 rounded-2xl p-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* INFO */}
      {online && !location && !error && (
        <div className="mt-5 bg-blue-50 text-blue-700 rounded-2xl p-4 text-sm">
          📡 Sedang mencari lokasi GPS...
        </div>
      )}
    </div>
  );
}

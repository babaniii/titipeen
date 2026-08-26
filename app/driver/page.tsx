"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import DriverTracker from "../components/DriverTracker";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
});

type Location = {
  lat: number;
  lng: number;
};

export default function DriverPage() {
  const [location, setLocation] = useState<Location | null>(null);

  const handleLocationUpdate = useCallback((newLocation: Location) => {
    setLocation(newLocation);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-5 py-5">
          <h1 className="text-3xl font-black">
            Titipeen
            <span className="text-blue-600">.</span>
          </h1>

          <p className="text-sm text-slate-500">Driver Dashboard</p>
        </div>
      </header>

      {/* CONTENT */}
      <section className="max-w-5xl mx-auto px-5 py-8">
        {/* DRIVER STATUS */}
        <DriverTracker onLocationUpdate={handleLocationUpdate} />

        {/* MAP */}
        <div className="bg-white rounded-3xl border shadow-sm p-4 mt-6">
          <Map driverLocation={location} customerLocation={null} pickups={[]} />
        </div>
      </section>
    </main>
  );
}

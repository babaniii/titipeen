"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    const loadLocation = async () => {
      const response = await fetch("/api/driver-location", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.location) {
        setLocation(data.location);
      }
    };

    loadLocation();

    const interval = setInterval(loadLocation, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-5 py-5">
          <h1 className="text-3xl font-black">
            Titipeen<span className="text-blue-600">.</span>
          </h1>

          <p className="text-sm text-slate-500">Driver Dashboard</p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 py-8">
        <DriverTracker />

        <div className="bg-white rounded-3xl border shadow-sm p-4 mt-6">
          <Map driverLocation={location} customerLocation={null} pickups={[]} />
        </div>
      </section>
    </main>
  );
}

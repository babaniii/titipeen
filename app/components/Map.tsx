"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LocationPoint = {
  lat: number;
  lng: number;
};

export type PickupPoint = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  driverLocation: LocationPoint | null;
  customerLocation: LocationPoint | null;
  pickups: PickupPoint[];
  onCustomerMove?: (location: LocationPoint) => void;
};

export default function Map({
  driverLocation,
  customerLocation,
  pickups,
  onCustomerMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  const driverMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);

  const pickupMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current).setView([-6.9932, 110.4203], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /*
   * DRIVER
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !driverLocation) {
      return;
    }

    if (!driverMarkerRef.current) {
      const marker = L.marker([driverLocation.lat, driverLocation.lng]).addTo(
        map,
      );

      marker.bindPopup("🛵 Posisi Driver Titipeen");

      driverMarkerRef.current = marker;
    } else {
      driverMarkerRef.current.setLatLng([
        driverLocation.lat,
        driverLocation.lng,
      ]);
    }
  }, [driverLocation]);

  /*
   * CUSTOMER
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !customerLocation) {
      return;
    }

    if (!customerMarkerRef.current) {
      const marker = L.marker([customerLocation.lat, customerLocation.lng], {
        draggable: true,
      }).addTo(map);

      marker.bindPopup("🏠 Lokasi Anda<br/>Marker dapat digeser.");

      marker.on("dragend", () => {
        const position = marker.getLatLng();

        onCustomerMove?.({
          lat: position.lat,
          lng: position.lng,
        });
      });

      customerMarkerRef.current = marker;
    } else {
      customerMarkerRef.current.setLatLng([
        customerLocation.lat,
        customerLocation.lng,
      ]);
    }
  }, [customerLocation, onCustomerMove]);

  /*
   * PICKUPS
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    pickupMarkersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });

    pickupMarkersRef.current = [];

    pickups.forEach((pickup, index) => {
      const marker = L.marker([pickup.lat, pickup.lng]).addTo(map);

      marker.bindPopup(`🛍️ Pembelian ${index + 1}<br/>${pickup.name}`);

      pickupMarkersRef.current.push(marker);
    });
  }, [pickups]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] rounded-3xl overflow-hidden"
    />
  );
}

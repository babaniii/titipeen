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

function createIcon(emoji: string, background: string) {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:42px;
          height:42px;
          border-radius:50%;
          background:${background};
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:22px;
          border:3px solid white;
          box-shadow:0 3px 10px rgba(0,0,0,.3);
        "
      >
        ${emoji}
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
  });
}

const driverIcon = createIcon("🛵", "#2563eb");

const customerIcon = createIcon("🏠", "#16a34a");

const pickupIcon = createIcon("🛍️", "#f97316");

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
   * DRIVER MARKER
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !driverLocation) {
      return;
    }

    const position = [
      driverLocation.lat,
      driverLocation.lng,
    ] as L.LatLngExpression;

    if (!driverMarkerRef.current) {
      const marker = L.marker(position, {
        icon: driverIcon,
      }).addTo(map);

      marker.bindPopup("🛵 Driver Titipeen");

      driverMarkerRef.current = marker;
    } else {
      driverMarkerRef.current.setLatLng(position);
    }
  }, [driverLocation]);

  /*
   * CUSTOMER MARKER
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !customerLocation) {
      return;
    }

    const position = [
      customerLocation.lat,
      customerLocation.lng,
    ] as L.LatLngExpression;

    if (!customerMarkerRef.current) {
      const marker = L.marker(position, {
        icon: customerIcon,
        draggable: true,
      }).addTo(map);

      marker.bindPopup("🏠 Lokasi Customer<br/>Marker dapat digeser.");

      marker.on("dragend", () => {
        const pos = marker.getLatLng();

        onCustomerMove?.({
          lat: pos.lat,
          lng: pos.lng,
        });
      });

      customerMarkerRef.current = marker;
    } else {
      customerMarkerRef.current.setLatLng(position);
    }
  }, [customerLocation, onCustomerMove]);

  /*
   * PICKUP MARKERS
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
      const marker = L.marker([pickup.lat, pickup.lng], {
        icon: pickupIcon,
      }).addTo(map);

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

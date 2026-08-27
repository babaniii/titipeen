"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const Map = dynamic(() => import("./components/Map"), {
  ssr: false,
});

type Location = {
  lat: number;
  lng: number;
};

type Pickup = {
  name: string;
  address: string;
  coordinates: string;
  lat: number;
  lng: number;
};

const TARIFF_PER_100M = 250;

export default function Home() {
  /*
   * =====================================================
   * CUSTOMER
   * =====================================================
   */

  const [customerLocation, setCustomerLocation] = useState<Location | null>(
    null,
  );

  const [customerAddress, setCustomerAddress] = useState("");

  /*
   * =====================================================
   * DRIVER
   * =====================================================
   */

  const [driverLocation, setDriverLocation] = useState<Location | null>(null);

  /*
   * =====================================================
   * PICKUP / LOKASI PEMBELIAN
   * =====================================================
   */

  const [pickups, setPickups] = useState<Pickup[]>([
    {
      name: "",
      address: "",
      coordinates: "",
      lat: 0,
      lng: 0,
    },
  ]);

  /*
   * =====================================================
   * RESULT
   * =====================================================
   */

  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);

  const [calculating, setCalculating] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  /*
   * =====================================================
   * DRIVER LOCATION
   *
   * Customer mengambil posisi driver dari server.
   * Update setiap 5 detik.
   * =====================================================
   */

  useEffect(() => {
    const loadDriver = async () => {
      try {
        const response = await fetch("/api/driver-location", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.location) {
          setDriverLocation(data.location);
        }
      } catch (error) {
        console.error("Gagal mengambil lokasi driver:", error);
      }
    };

    loadDriver();

    const interval = setInterval(loadDriver, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * =====================================================
   * CUSTOMER GPS
   * =====================================================
   */

  const getMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung GPS.");
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setFare(0);
        setDistance(0);

        setLoadingLocation(false);
      },
      () => {
        alert(
          "Lokasi gagal diambil. Pastikan GPS aktif dan izin lokasi diberikan.",
        );

        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  /*
   * =====================================================
   * CUSTOMER LOCATION UPDATE
   *
   * Dipakai ketika marker customer digeser di map.
   * =====================================================
   */

  const updateCustomerLocation = useCallback((location: Location) => {
    setCustomerLocation(location);

    setFare(0);
    setDistance(0);
  }, []);

  /*
   * =====================================================
   * PICKUP MANAGEMENT
   * =====================================================
   */

  const addPickup = () => {
    setPickups((current) => [
      ...current,
      {
        name: "",
        address: "",
        coordinates: "",
        lat: 0,
        lng: 0,
      },
    ]);

    setFare(0);
    setDistance(0);
  };

  const removePickup = (index: number) => {
    setPickups((current) => current.filter((_, i) => i !== index));

    setFare(0);
    setDistance(0);
  };

  const updatePickup = (index: number, field: keyof Pickup, value: string) => {
    setPickups((current) => {
      const updated = [...current];

      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      /*
       * Kalau koordinat diedit ulang,
       * titik lama dianggap tidak valid lagi.
       */
      if (field === "coordinates") {
        updated[index].lat = 0;
        updated[index].lng = 0;
      }

      return updated;
    });

    setFare(0);
    setDistance(0);
  };

  /*
   * =====================================================
   * PARSE KOORDINAT
   *
   * Mendukung:
   *
   * 1. -6.9955145, 110.4242921
   *
   * 2. -6,9955145, 110,4242921
   *
   * =====================================================
   */

  const parseCoordinates = (input: string) => {
    const value = input.trim();

    /*
     * FORMAT NORMAL
     *
     * -6.9955145, 110.4242921
     */

    const normalMatch = value.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
    );

    if (normalMatch) {
      const lat = Number(normalMatch[1]);
      const lng = Number(normalMatch[2]);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return {
          lat,
          lng,
        };
      }
    }

    /*
     * FORMAT KOMA DESIMAL
     *
     * -6,9955145, 110,4242921
     *
     * Hasil split:
     *
     * ["-6", "9955145", "110", "4242921"]
     */

    const parts = value.split(",").map((part) => part.trim());

    if (parts.length === 4) {
      const lat = Number(`${parts[0]}.${parts[1]}`);
      const lng = Number(`${parts[2]}.${parts[3]}`);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return {
          lat,
          lng,
        };
      }
    }

    return null;
  };

  /*
   * =====================================================
   * APPLY KOORDINAT KE PICKUP
   * =====================================================
   */

  const applyPickupCoordinates = (index: number) => {
    const pickup = pickups[index];

    if (!pickup.coordinates.trim()) {
      alert("Masukkan koordinat lokasi pembelian terlebih dahulu.");

      return;
    }

    const result = parseCoordinates(pickup.coordinates);

    if (!result) {
      alert(
        "Format koordinat tidak valid.\n\n" +
          "Contoh:\n" +
          "-6.9955145, 110.4242921\n\n" +
          "atau:\n" +
          "-6,9955145, 110,4242921",
      );

      return;
    }

    setPickups((current) => {
      const updated = [...current];

      updated[index] = {
        ...updated[index],
        lat: result.lat,
        lng: result.lng,
      };

      return updated;
    });

    setFare(0);
    setDistance(0);
  };

  /*
   * =====================================================
   * HITUNG RUTE
   *
   * Driver
   *    ↓
   * Pickup 1
   *    ↓
   * Pickup 2
   *    ↓
   * Pickup dst
   *    ↓
   * Customer
   *
   * Menggunakan OSRM.
   * =====================================================
   */

  const calculateRoute = async () => {
    if (!driverLocation) {
      alert("Driver sedang offline atau posisi driver belum tersedia.");

      return;
    }

    if (!customerLocation) {
      alert("Pilih lokasi kamu terlebih dahulu.");

      return;
    }

    /*
     * Pastikan semua pickup:
     *
     * - punya nama
     * - punya latitude
     * - punya longitude
     */

    const invalidPickup = pickups.some(
      (pickup) => !pickup.name.trim() || pickup.lat === 0 || pickup.lng === 0,
    );

    if (invalidPickup) {
      alert(
        "Lengkapi semua lokasi pembelian dan pastikan koordinatnya sudah digunakan.",
      );

      return;
    }

    setCalculating(true);

    try {
      /*
       * DRIVER
       * ↓
       * PICKUPS
       * ↓
       * CUSTOMER
       */

      const routePoints = [
        driverLocation,

        ...pickups.map((pickup) => ({
          lat: pickup.lat,
          lng: pickup.lng,
        })),

        customerLocation,
      ];

      /*
       * OSRM membutuhkan:
       *
       * longitude,latitude
       */

      const coordinates = routePoints
        .map((point) => `${point.lng},${point.lat}`)
        .join(";");

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        coordinates +
        `?overview=false`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Server routing tidak merespons.");
      }

      const data = await response.json();

      if (data.code !== "Ok") {
        throw new Error("Route tidak tersedia.");
      }

      if (
        !data.routes ||
        !data.routes[0] ||
        typeof data.routes[0].distance !== "number"
      ) {
        throw new Error("Data jarak tidak tersedia.");
      }

      const meters = data.routes[0].distance;

      /*
       * TARIF:
       *
       * Rp250 / 100 meter
       *
       * Contoh:
       *
       * 100m  = Rp250
       * 101m  = Rp500
       * 200m  = Rp500
       * 201m  = Rp750
       */

      const calculatedFare = Math.ceil(meters / 100) * TARIFF_PER_100M;

      setDistance(meters);
      setFare(calculatedFare);
    } catch (error) {
      console.error("Calculate route error:", error);

      alert("Gagal menghitung rute. Coba lagi.");
    } finally {
      setCalculating(false);
    }
  };

  /*
   * =====================================================
   * WHATSAPP
   * =====================================================
   */

  const sendWhatsApp = () => {
    if (!customerLocation) {
      alert("Lokasi customer belum dipilih.");

      return;
    }

    if (!driverLocation) {
      alert("Posisi driver belum tersedia.");

      return;
    }

    if (!fare) {
      alert("Hitung ongkir terlebih dahulu.");

      return;
    }

    /*
     * DATA PEMBELIAN
     */

    const pickupText = pickups
      .map(
        (pickup, index) =>
          `🛍️ PEMBELIAN ${index + 1}
Nama: ${pickup.name}
Alamat: ${pickup.address || "-"}
Koordinat: ${pickup.lat}, ${pickup.lng}
Lokasi: https://www.google.com/maps?q=${pickup.lat},${pickup.lng}`,
      )
      .join("\n\n");

    /*
     * PESAN WHATSAPP
     */

    const message =
      `*ORDER by TITIPEEN*\n\n` +
      `*ONGKIR:* Rp${fare.toLocaleString("id-ID")}\n` +
      `*TOTAL JARAK:* ${(distance / 1000).toFixed(2)} KM\n` +
      `*TARIF:* Rp250 / 100 meter\n\n` +
      `*POSISI DRIVER SAAT ORDER*\n` +
      `https://www.google.com/maps?q=${driverLocation.lat},${driverLocation.lng}\n\n` +
      `${pickupText}\n\n` +
      `*LOKASI CUSTOMER*\n` +
      `https://www.google.com/maps?q=${customerLocation.lat},${customerLocation.lng}\n\n` +
      `*ALAMAT CUSTOMER*\n` +
      `${customerAddress || "-"}\n\n` +
      `Mohon diproses ya 🙏`;

    /*
     * NOMOR WHATSAPP
     *
     * Diambil dari:
     *
     * NEXT_PUBLIC_DRIVER_WHATSAPP
     */

    const phone = process.env.NEXT_PUBLIC_DRIVER_WHATSAPP;

    if (!phone) {
      alert("Nomor WhatsApp driver belum diatur.");

      return;
    }

    /*
     * Pastikan nomor hanya angka.
     *
     * Contoh:
     *
     * 628123456789
     */

    const cleanPhone = phone.replace(/\D/g, "");

    const url =
      `https://wa.me/${cleanPhone}` + `?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  /*
   * =====================================================
   * PICKUP YANG SUDAH PUNYA TITIK
   *
   * Hanya pickup yang punya koordinat
   * dikirim ke Map.
   * =====================================================
   */

  const visiblePickups = pickups.filter(
    (pickup) => pickup.lat !== 0 && pickup.lng !== 0,
  );

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <main className="min-h-screen bg-slate-50">
      {/* =================================================
          HEADER
          ================================================= */}

      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Titipeen
              <span className="text-blue-600">.</span>
            </h1>

            <p className="text-sm text-slate-500">Titip apa aja, kami bantu.</p>
          </div>
        </div>
      </header>

      {/* =================================================
          HERO
          ================================================= */}

      <section className="max-w-7xl mx-auto px-5 py-10">
        <div className="max-w-3xl">
          <span className="text-blue-600 font-black text-sm">
            PERSONAL DELIVERY
          </span>

          <h2 className="text-5xl font-black tracking-tight mt-2">
            Mau titip beli sesuatu?
          </h2>

          <p className="text-slate-500 mt-4 text-lg">
            Pilih lokasi kamu, masukkan toko tujuan, lalu Titipeen hitungkan
            ongkirnya.
          </p>
        </div>
      </section>

      {/* =================================================
          CONTENT
          ================================================= */}

      <section className="max-w-7xl mx-auto px-5 pb-16">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* =================================================
              MAP
              ================================================= */}

          <div className="lg:col-span-3 bg-white rounded-3xl p-4 border shadow-sm">
            <Map
              driverLocation={driverLocation}
              customerLocation={customerLocation}
              pickups={visiblePickups}
              onCustomerMove={updateCustomerLocation}
            />

            {/* MAP LEGEND */}

            <div className="flex flex-wrap gap-3 mt-4 px-2">
              <span className="text-xs bg-slate-100 rounded-full px-3 py-2">
                🛵 Driver
              </span>

              <span className="text-xs bg-slate-100 rounded-full px-3 py-2">
                🛍️ Toko
              </span>

              <span className="text-xs bg-slate-100 rounded-full px-3 py-2">
                🏠 Customer
              </span>
            </div>
          </div>

          {/* =================================================
              FORM
              ================================================= */}

          <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm p-6">
            <h3 className="text-2xl font-black">Pesan Titipeen</h3>

            <p className="text-sm text-slate-500 mt-1">
              Bayar online setelah ongkir dihitung.
            </p>

            {/* =================================================
                CUSTOMER LOCATION
                ================================================= */}

            <button
              onClick={getMyLocation}
              disabled={loadingLocation}
              className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-2xl py-4 font-black"
            >
              {loadingLocation
                ? "📍 Mengambil lokasi..."
                : "📍 Pilih Lokasi Saya"}
            </button>

            {customerLocation && (
              <div className="mt-3 bg-green-50 rounded-2xl p-4">
                <p className="text-sm font-black text-green-700">
                  ✅ Lokasi tersimpan
                </p>

                <p className="text-xs text-green-600 mt-1">
                  Marker dapat digeser di peta.
                </p>

                <p className="text-xs text-green-600 mt-2 font-mono">
                  {customerLocation.lat.toFixed(7)},{" "}
                  {customerLocation.lng.toFixed(7)}
                </p>
              </div>
            )}

            {/* CUSTOMER ADDRESS */}

            <textarea
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Alamat lengkap kamu..."
              className="w-full mt-4 border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            {/* =================================================
                PICKUP SECTION
                ================================================= */}

            <div className="border-t my-6" />

            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black">🛍️ Lokasi Pembelian</h4>

                <p className="text-xs text-slate-400 mt-1">
                  Masukkan koordinat lokasi toko
                </p>
              </div>

              <button
                onClick={addPickup}
                className="text-blue-600 text-sm font-black"
              >
                + Tambah
              </button>
            </div>

            {/* INFO COORDINATE */}

            <div className="bg-blue-50 text-blue-700 rounded-2xl p-4 mt-4 text-xs leading-relaxed">
              <b>📍 Cara mengisi lokasi toko:</b>
              <br />
              1. Masuk ke aplikasi GoogleMaps
              <br />
              2. Cari lokasi toko, misal: "Apotek Sugiyopranoto"
              <br />
              3. Klik dan tahan jalanan depan toko agar muncul pin
              <br />
              4. Kemudian cari tulisan bermodelkan angka seperti contoh:
              10,09889, 100,28378478
              <br />
              5. Klik, selamat anda berhasil menyalin koordinat lokasi toko
              untuk cek ongkir
            </div>

            {/* =================================================
                PICKUP LIST
                ================================================= */}

            {pickups.map((pickup, index) => (
              <div key={index} className="bg-slate-50 rounded-2xl p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <b className="text-sm">Pembelian {index + 1}</b>

                  {pickups.length > 1 && (
                    <button
                      onClick={() => removePickup(index)}
                      className="text-red-500 text-xs font-bold"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {/* NAMA TOKO */}

                <input
                  value={pickup.name}
                  onChange={(e) => updatePickup(index, "name", e.target.value)}
                  placeholder="Contoh: Chikuro"
                  className="w-full border rounded-xl p-3 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* ALAMAT TOKO */}

                <input
                  value={pickup.address}
                  onChange={(e) =>
                    updatePickup(index, "address", e.target.value)
                  }
                  placeholder="Alamat toko (opsional)"
                  className="w-full border rounded-xl p-3 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* KOORDINAT */}

                <input
                  value={pickup.coordinates}
                  onChange={(e) =>
                    updatePickup(index, "coordinates", e.target.value)
                  }
                  placeholder="-6.9955145, 110.4242921"
                  className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* APPLY COORDINATE */}

                <button
                  onClick={() => applyPickupCoordinates(index)}
                  className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 text-sm font-black"
                >
                  📍 Gunakan Koordinat
                </button>

                {/* SUCCESS */}

                {pickup.lat !== 0 && pickup.lng !== 0 && (
                  <div className="mt-3 bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-700 font-black">
                      ✅ Titik toko ditemukan
                    </p>

                    <p className="text-[11px] text-green-600 mt-1 font-mono break-all">
                      {pickup.lat}, {pickup.lng}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* =================================================
                CALCULATE
                ================================================= */}

            <button
              onClick={calculateRoute}
              disabled={calculating}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl py-4 font-black"
            >
              {calculating ? "⏳ Menghitung rute..." : "🛵 Hitung Ongkir"}
            </button>

            {/* =================================================
                RESULT
                ================================================= */}

            {fare > 0 && (
              <div className="mt-5 bg-slate-950 text-white rounded-3xl p-6">
                <p className="text-xs text-slate-400">TOTAL JARAK</p>

                <p className="text-3xl font-black mt-1">
                  {(distance / 1000).toFixed(2)} KM
                </p>

                <p className="text-xs text-slate-400 mt-5">ONGKIR</p>

                <p className="text-4xl font-black text-blue-400">
                  Rp
                  {fare.toLocaleString("id-ID")}
                </p>

                <p className="text-xs text-slate-500 mt-2">Rp250 / 100 meter</p>

                {/* WHATSAPP */}

                <button
                  onClick={sendWhatsApp}
                  className="w-full mt-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-4 font-black"
                >
                  💬 Hubungi Driver
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

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
  mapsLink: string;
  lat: number;
  lng: number;
};

const TARIFF_PER_100M = 250;

export default function Home() {
  /*
   * CUSTOMER
   */

  const [customerLocation, setCustomerLocation] = useState<Location | null>(
    null,
  );

  const [customerAddress, setCustomerAddress] = useState("");

  /*
   * DRIVER
   */

  const [driverLocation, setDriverLocation] = useState<Location | null>(null);

  /*
   * PICKUPS
   */

  const [pickups, setPickups] = useState<Pickup[]>([
    {
      name: "",
      address: "",
      mapsLink: "",
      lat: 0,
      lng: 0,
    },
  ]);

  /*
   * RESULT
   */

  const [distance, setDistance] = useState(0);

  const [fare, setFare] = useState(0);

  const [calculating, setCalculating] = useState(false);

  const [loadingLocation, setLoadingLocation] = useState(false);

  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);

  /*
   * DRIVER LOCATION
   *
   * Ambil setiap 5 detik.
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
        console.error(error);
      }
    };

    loadDriver();

    const interval = setInterval(loadDriver, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * GPS CUSTOMER
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

  const updateCustomerLocation = useCallback((location: Location) => {
    setCustomerLocation(location);

    setFare(0);
    setDistance(0);
  }, []);

  /*
   * PICKUPS
   */

  const addPickup = () => {
    setPickups([
      ...pickups,
      {
        name: "",
        address: "",
        mapsLink: "",
        lat: 0,
        lng: 0,
      },
    ]);
  };

  const removePickup = (index: number) => {
    setPickups(pickups.filter((_, i) => i !== index));
  };

  const updatePickup = (index: number, field: keyof Pickup, value: string) => {
    const updated = [...pickups];

    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setPickups(updated);

    setFare(0);
    setDistance(0);
  };

  /*
   * GOOGLE MAPS RESOLVER
   */

  const resolveMapsLink = async (index: number) => {
    const pickup = pickups[index];

    if (!pickup.mapsLink) {
      alert("Paste link Google Maps terlebih dahulu.");

      return;
    }

    setResolvingIndex(index);

    try {
      const response = await fetch("/api/resolve-maps", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          url: pickup.mapsLink,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || "Link Google Maps tidak bisa diproses.");

        return;
      }

      const updated = [...pickups];

      updated[index] = {
        ...updated[index],

        lat: data.latitude,

        lng: data.longitude,
      };

      setPickups(updated);

      alert("📍 Lokasi pembelian berhasil ditemukan!");
    } catch (error) {
      console.error(error);

      alert("Terjadi kesalahan saat membaca link.");
    } finally {
      setResolvingIndex(null);
    }
  };

  /*
   * ROUTE
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

    const invalidPickup = pickups.some(
      (pickup) => !pickup.name || pickup.lat === 0 || pickup.lng === 0,
    );

    if (invalidPickup) {
      alert(
        "Lengkapi semua lokasi pembelian dan pastikan titiknya sudah ditemukan.",
      );

      return;
    }

    setCalculating(true);

    try {
      /*
       * DRIVER
       * ↓
       * PICKUP 1
       * ↓
       * PICKUP 2
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

      const coordinates = routePoints
        .map((point) => `${point.lng},${point.lat}`)
        .join(";");

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        coordinates +
        `?overview=false`;

      const response = await fetch(url);

      const data = await response.json();

      if (data.code !== "Ok") {
        throw new Error("Route tidak tersedia.");
      }

      const meters = data.routes[0].distance;

      /*
       * Rp250 per 100 meter
       *
       * 1 meter pun dihitung
       * sebagai blok 100m berikutnya.
       */

      const fare = Math.ceil(meters / 100) * TARIFF_PER_100M;

      setDistance(meters);

      setFare(fare);
    } catch (error) {
      console.error(error);

      alert("Gagal menghitung rute.");
    } finally {
      setCalculating(false);
    }
  };

  /*
   * WHATSAPP
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

    const pickupText = pickups
      .map(
        (pickup, index) =>
          `🛍️ PEMBELIAN ${index + 1}
Nama: ${pickup.name}
Alamat: ${pickup.address || "-"}
Lokasi: https://www.google.com/maps?q=${pickup.lat},${pickup.lng}`,
      )
      .join("\n\n");

    const message =
      `🛵 *ORDER TITIPEEN*\n\n` +
      `💰 *ONGKIR:* Rp${fare.toLocaleString("id-ID")}\n` +
      `📏 *TOTAL JARAK:* ${(distance / 1000).toFixed(2)} KM\n` +
      `💵 *TARIF:* Rp250 / 100 meter\n\n` +
      `🛵 *POSISI DRIVER SAAT ORDER*\n` +
      `https://www.google.com/maps?q=${driverLocation.lat},${driverLocation.lng}\n\n` +
      `${pickupText}\n\n` +
      `🏠 *LOKASI CUSTOMER*\n` +
      `https://www.google.com/maps?q=${customerLocation.lat},${customerLocation.lng}\n\n` +
      `📍 *ALAMAT CUSTOMER*\n` +
      `${customerAddress || "-"}\n\n` +
      `Mohon diproses ya 🙏`;

    const phone = process.env.NEXT_PUBLIC_DRIVER_WHATSAPP;

    if (!phone) {
      alert("Nomor WhatsApp driver belum diatur.");

      return;
    }

    const url =
      `https://wa.me/${phone}` + `?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  };

  const visiblePickups = pickups.filter(
    (pickup) => pickup.lat !== 0 && pickup.lng !== 0,
  );

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HEADER */}

      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Titipeen
              <span className="text-blue-600">.</span>
            </h1>

            <p className="text-sm text-slate-500">Titip apa aja, kami bantu.</p>
          </div>

          <a
            href="/driver"
            className="text-sm font-bold text-slate-500 hover:text-blue-600"
          >
            Driver
          </a>
        </div>
      </header>

      {/* HERO */}

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

      {/* CONTENT */}

      <section className="max-w-7xl mx-auto px-5 pb-16">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* MAP */}

          <div className="lg:col-span-3 bg-white rounded-3xl p-4 border shadow-sm">
            <Map
              driverLocation={driverLocation}
              customerLocation={customerLocation}
              pickups={visiblePickups}
              onCustomerMove={updateCustomerLocation}
            />

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

          {/* FORM */}

          <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm p-6">
            <h3 className="text-2xl font-black">Pesan Titipeen</h3>

            <p className="text-sm text-slate-500 mt-1">
              Bayar online setelah ongkir dihitung.
            </p>

            {/* CUSTOMER LOCATION */}

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
              </div>
            )}

            <textarea
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Alamat lengkap kamu..."
              className="w-full mt-4 border rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            {/* PICKUP */}

            <div className="border-t my-6" />

            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-black">🛍️ Lokasi Pembelian</h4>

                <p className="text-xs text-slate-400 mt-1">
                  Paste link Google Maps
                </p>
              </div>

              <button
                onClick={addPickup}
                className="text-blue-600 text-sm font-black"
              >
                + Tambah
              </button>
            </div>

            <div className="bg-blue-50 text-blue-700 rounded-2xl p-4 mt-4 text-xs leading-relaxed">
              <b>Cara mencari toko:</b>
              <br />
              Buka Google Maps → cari toko → Share → Copy link → paste di bawah.
            </div>

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

                <input
                  value={pickup.name}
                  onChange={(e) => updatePickup(index, "name", e.target.value)}
                  placeholder="Contoh: Chikuro"
                  className="w-full border rounded-xl p-3 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  value={pickup.address}
                  onChange={(e) =>
                    updatePickup(index, "address", e.target.value)
                  }
                  placeholder="Alamat toko (opsional)"
                  className="w-full border rounded-xl p-3 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  value={pickup.mapsLink}
                  onChange={(e) =>
                    updatePickup(index, "mapsLink", e.target.value)
                  }
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={() => resolveMapsLink(index)}
                  disabled={resolvingIndex === index}
                  className="w-full mt-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl py-3 text-sm font-black"
                >
                  {resolvingIndex === index
                    ? "⏳ Mencari lokasi..."
                    : "📍 Ambil Titik dari Link"}
                </button>

                {pickup.lat !== 0 && (
                  <div className="mt-3 text-xs text-green-600 font-bold">
                    ✅ Titik ditemukan
                  </div>
                )}
              </div>
            ))}

            {/* CALCULATE */}

            <button
              onClick={calculateRoute}
              disabled={calculating}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl py-4 font-black"
            >
              {calculating ? "⏳ Menghitung rute..." : "🛵 Hitung Ongkir"}
            </button>

            {/* RESULT */}

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

                <button
                  onClick={sendWhatsApp}
                  className="w-full mt-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-4 font-black"
                >
                  💬 Pesan Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

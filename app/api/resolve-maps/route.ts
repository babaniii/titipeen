import { NextRequest, NextResponse } from "next/server";

function extractCoordinates(text: string) {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);

    if (match) {
      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }
  }

  return null;
}

function extractPlaceFromGoogleMapsUrl(url: string) {
  try {
    const decoded = decodeURIComponent(url);

    const match = decoded.match(/\/maps\/place\/([^/]+)/);

    if (!match) {
      return null;
    }

    return match[1].replace(/\+/g, " ").trim();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const inputUrl = body.url;

    if (!inputUrl || typeof inputUrl !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Maps tidak ditemukan.",
        },
        { status: 400 },
      );
    }

    if (
      !inputUrl.includes("maps.app.goo.gl") &&
      !inputUrl.includes("google.com/maps") &&
      !inputUrl.includes("maps.google.com")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Link harus berasal dari Google Maps.",
        },
        { status: 400 },
      );
    }

    // Follow Google Maps short-link redirect
    const response = await fetch(inputUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      },
      cache: "no-store",
    });

    const finalUrl = response.url;

    // =====================================================
    // 1. Coba cari koordinat langsung dari URL
    // =====================================================

    let coordinates = extractCoordinates(finalUrl);

    if (coordinates) {
      return NextResponse.json({
        success: true,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        finalUrl,
      });
    }

    // =====================================================
    // 2. Kalau tidak ada koordinat, ambil nama tempat
    // =====================================================

    const place = extractPlaceFromGoogleMapsUrl(finalUrl);

    if (!place) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Link Google Maps berhasil dibuka, tetapi nama lokasi tidak ditemukan.",
          finalUrl,
        },
        { status: 422 },
      );
    }

    // =====================================================
    // 3. Geocoding menggunakan Nominatim / OpenStreetMap
    // =====================================================

    const searchUrl =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: place,
        format: "json",
        limit: "1",
        countrycodes: "id",
      }).toString();

    const geoResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Titipeen/1.0 contact: titipeen",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!geoResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Layanan pencarian lokasi sedang bermasalah.",
        },
        { status: 502 },
      );
    }

    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Lokasi berhasil ditemukan di Google Maps, tetapi koordinatnya tidak berhasil diperoleh.",
          place,
          finalUrl,
        },
        { status: 422 },
      );
    }

    const result = geoData[0];

    return NextResponse.json({
      success: true,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      place,
      displayName: result.display_name,
      finalUrl,
    });
  } catch (error) {
    console.error("Resolve Maps Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memproses link Google Maps.",
      },
      { status: 500 },
    );
  }
}

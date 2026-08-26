import { NextRequest, NextResponse } from "next/server";

function extractCoordinates(text: string) {
  const patterns = [
    // @-6.12345,110.12345
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,

    // !3d-6.12345!4d110.12345
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,

    // ?q=-6.12345,110.12345
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,

    // /place/-6.12345,110.12345
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const url = body.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Maps tidak ditemukan.",
        },
        { status: 400 },
      );
    }

    // Hanya izinkan Google Maps
    if (
      !url.includes("maps.app.goo.gl") &&
      !url.includes("google.com/maps") &&
      !url.includes("maps.google.com")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Link harus berasal dari Google Maps.",
        },
        { status: 400 },
      );
    }

    /*
     * Fetch short URL dan ikuti redirect.
     */
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      },
      cache: "no-store",
    });

    /*
     * URL terakhir setelah redirect.
     */
    const finalUrl = response.url;

    /*
     * Coba cari koordinat dari URL hasil redirect.
     */
    let coordinates = extractCoordinates(finalUrl);

    /*
     * Kalau belum ketemu, baca HTML.
     */
    if (!coordinates) {
      const html = await response.text();

      coordinates = extractCoordinates(html);
    }

    if (!coordinates) {
      return NextResponse.json(
        {
          success: false,
          message: "Link berhasil dibuka, tetapi koordinat tidak ditemukan.",
          finalUrl,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      finalUrl,
    });
  } catch (error) {
    console.error("Google Maps resolver error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal membaca link Google Maps.",
      },
      { status: 500 },
    );
  }
}

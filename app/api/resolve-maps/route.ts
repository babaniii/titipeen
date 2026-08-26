import { NextRequest, NextResponse } from "next/server";

function extractCoordinates(url: string) {
  const patterns = [
    /*
     * Google Maps:
     * @-6.12345,110.12345
     */
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,

    /*
     * Google Maps:
     * !3d-6.12345!4d110.12345
     */
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,

    /*
     * ?q=-6.12345,110.12345
     */
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,

    /*
     * ?query=-6.12345,110.12345
     */
    /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,

    /*
     * /-6.12345,110.12345
     */
    /\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (!match) {
      continue;
    }

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat,
        lng,
      };
    }
  }

  return null;
}

async function resolveRedirects(startUrl: string) {
  let currentUrl = startUrl;

  for (let i = 0; i < 6; i++) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 Titipeen",
      },
      cache: "no-store",
    });

    const location = response.headers.get("location");

    if (!location) {
      return currentUrl;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  return currentUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const input = String(body.url || "").trim();

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          message: "Link Google Maps kosong.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !input.includes("google.com/maps") &&
      !input.includes("maps.app.goo.gl") &&
      !input.includes("goo.gl/maps")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Link bukan link Google Maps.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Coba ambil koordinat langsung
     */

    let coordinates = extractCoordinates(input);

    let finalUrl = input;

    /*
     * Kalau belum ketemu,
     * resolve redirect.
     */

    if (!coordinates) {
      finalUrl = await resolveRedirects(input);

      coordinates = extractCoordinates(finalUrl);
    }

    if (!coordinates) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Link berhasil dibuka, tetapi koordinat tidak ditemukan. Coba dari Google Maps pilih lokasi/pin lalu Share → Copy link.",
          finalUrl,
        },
        {
          status: 422,
        },
      );
    }

    return NextResponse.json({
      success: true,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      resolvedUrl: finalUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memproses link Google Maps.",
      },
      {
        status: 500,
      },
    );
  }
}

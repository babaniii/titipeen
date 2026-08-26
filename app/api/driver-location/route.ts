import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("driver_locations")
      .select("latitude, longitude, updated_at")
      .eq("id", "main-driver")
      .single();

    if (error) {
      return NextResponse.json(
        {
          location: null,
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      location: {
        lat: data.latitude,
        lng: data.longitude,
      },
      updatedAt: data.updated_at,
    });
  } catch {
    return NextResponse.json(
      {
        location: null,
      },
      {
        status: 500,
      },
    );
  }
}

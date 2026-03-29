import MapDashboard from "@/components/MapDashboard";
import { createClient } from "@supabase/supabase-js";
import type { LocationItem } from "@/lib/types";

async function getInitialLocations(): Promise<LocationItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("locations")
    .select("id,name_th,type,address,lat,lng,created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    ...item,
    lat: Number(item.lat),
    lng: Number(item.lng),
  }));
}

export default async function Home() {
  const initialLocations = await getInitialLocations();
  return <MapDashboard initialLocations={initialLocations} />;
}

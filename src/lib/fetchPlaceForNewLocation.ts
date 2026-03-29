import { importLibrary } from "@googlemaps/js-api-loader";
import type { NewLocationInput, PendingMapPoi } from "@/lib/types";

/** เมื่อ Places API ใช้ไม่ได้ — ยังบันทึกพิกัดจากคลิก POI ได้ (แก้ชื่อ/ที่อยู่ทีหลัง) */
export function minimalLocationFromMapPoi(poi: PendingMapPoi): NewLocationInput {
  return {
    name_th: "สถานที่จากแผนที่ (แก้ชื่อได้)",
    type: "จากแผนที่",
    address: "",
    lat: poi.lat,
    lng: poi.lng,
  };
}

function readPlacesTextField(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    const t = (value as { text: unknown }).text;
    if (typeof t === "string") {
      return t.trim();
    }
  }
  return "";
}

function logPlacesFailure(err: unknown): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : String(err);
  console.warn("[fetchPlaceForNewLocation] Place.fetchFields ล้มเหลว:", msg);
}

/**
 * สำรองเมื่อ Places (New) ใช้ไม่ได้ — ย้อนพิกัดเป็นที่อยู่ (ต้องเปิด Geocoding API ให้คีย์เดียวกัน)
 */
async function tryGeocodeFallback(poi: PendingMapPoi): Promise<NewLocationInput | null> {
  const geocoder = new google.maps.Geocoder();
  const latLng = { lat: poi.lat, lng: poi.lng };

  const results = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
    geocoder.geocode({ location: latLng, language: "th" }, (res, status) => {
      if (status === google.maps.GeocoderStatus.OK && res?.length) {
        resolve(res);
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.warn("[fetchPlaceForNewLocation] Geocoder สำรอง:", status);
      }
      resolve(null);
    });
  });

  if (!results?.length) {
    return null;
  }

  const r = results[0];
  const address = (r.formatted_address ?? "").trim();
  let name_th = address.split(",")[0]?.trim() || "";

  for (const comp of r.address_components ?? []) {
    if (comp.types.includes("point_of_interest") || comp.types.includes("establishment")) {
      name_th = comp.long_name;
      break;
    }
  }

  if (!name_th) {
    name_th = "สถานที่จากแผนที่ (แก้ชื่อได้)";
  }

  return {
    name_th,
    type: "จากแผนที่ (ย้อนพิกัด)",
    address,
    lat: poi.lat,
    lng: poi.lng,
  };
}

/**
 * ดึงชื่อ/ที่อยู่/พิกัดจาก Places API (New) ในเบราว์เซอร์ (หลังผู้ใช้คลิก POI บนแผนที่)
 * ต้องให้แผนที่โหลดก่อน (MapView เรียก setOptions + importLibrary แล้ว) — ไม่เรียก setOptions ซ้ำ
 */
export async function fetchPlaceForNewLocation(poi: PendingMapPoi): Promise<NewLocationInput> {
  await importLibrary("maps");
  const { Place } = (await importLibrary("places")) as google.maps.PlacesLibrary;

  const idVariants = poi.placeId.startsWith("places/")
    ? [poi.placeId]
    : [poi.placeId, `places/${poi.placeId}`];

  let lastError: unknown;
  let placeInstance: InstanceType<typeof Place> | null = null;

  for (const id of idVariants) {
    try {
      const instance = new Place({
        id,
        requestedLanguage: "th",
      });
      await instance.fetchFields({
        fields: ["displayName", "formattedAddress", "location", "primaryTypeDisplayName"],
      });
      placeInstance = instance;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!placeInstance) {
    logPlacesFailure(lastError);
    const geo = await tryGeocodeFallback(poi);
    if (geo) {
      return geo;
    }
    throw lastError ?? new Error("Place.fetchFields failed");
  }

  const p = placeInstance;

  const name_th =
    readPlacesTextField(p.displayName as unknown) ||
    readPlacesTextField(p.primaryTypeDisplayName as unknown) ||
    "สถานที่";

  let address = "";
  if (typeof p.formattedAddress === "string") {
    address = p.formattedAddress.trim();
  } else {
    address = readPlacesTextField(p.formattedAddress as unknown);
  }

  const type =
    readPlacesTextField(p.primaryTypeDisplayName as unknown).trim() || "จากแผนที่";

  const loc = p.location;
  const lat = loc ? loc.lat() : poi.lat;
  const lng = loc ? loc.lng() : poi.lng;

  return {
    name_th,
    type,
    address,
    lat,
    lng,
  };
}

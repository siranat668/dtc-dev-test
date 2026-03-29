"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddLocationForm from "./AddLocationForm";
import LocationSidebar from "./LocationSidebar";
import MapView, { type MapViewHandle } from "./MapView";
import styles from "./MapApp.module.css";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  fetchPlaceForNewLocation,
  minimalLocationFromMapPoi,
} from "@/lib/fetchPlaceForNewLocation";
import type { FactoryLocation, LocationItem, NewLocationInput, PendingMapPoi } from "@/lib/types";

const fallbackFactoryLocation: FactoryLocation = {
  name: "โรงงาน สตีลชลบุรีกรุ๊ป",
  lat: 13.67393,
  lng: 100.61104,
};

function readFactoryLocation(): FactoryLocation {
  const lat = Number(process.env.NEXT_PUBLIC_FACTORY_LAT);
  const lng = Number(process.env.NEXT_PUBLIC_FACTORY_LNG);
  const name = process.env.NEXT_PUBLIC_FACTORY_NAME?.trim() || fallbackFactoryLocation.name;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return fallbackFactoryLocation;
  }

  return { name, lat, lng };
}

type MapDashboardProps = {
  initialLocations: LocationItem[];
};

export default function MapDashboard({ initialLocations }: MapDashboardProps) {
  const [locations, setLocations] = useState<LocationItem[]>(initialLocations);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [pendingMapPoi, setPendingMapPoi] = useState<PendingMapPoi | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addPlacementMode, setAddPlacementMode] = useState(false);
  const [addFormCoords, setAddFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addFormNonce, setAddFormNonce] = useState(0);
  const mapViewRef = useRef<MapViewHandle>(null);
  const pageRootRef = useRef<HTMLElement | null>(null);
  const [isSavingFromMapPoi, setIsSavingFromMapPoi] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoHint, setGeoHint] = useState("");
  const [mapSaveNotice, setMapSaveNotice] = useState("");
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<LocationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    initialLocations.length === 0 ? "ยังไม่มีข้อมูลสถานที่ หรือยังไม่ได้ตั้งค่า Supabase" : "",
  );

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const factoryLocation = useMemo(() => readFactoryLocation(), []);

  const clearListSelection = useCallback(() => {
    setSelectedLocationId(null);
  }, []);

  const handleMarkerSelect = useCallback((locationId: string) => {
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setAddPlacementMode(false);
    setSelectedLocationId(locationId);
  }, []);

  const handleSidebarSelectLocation = useCallback((locationId: string) => {
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setAddPlacementMode(false);
    setSelectedLocationId((prev) => (prev === locationId ? null : locationId));
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddOpen(false);
    setAddFormCoords(null);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setDeleteConfirmLocation(null);
  }, [isDeleting]);

  const handleRequestDelete = useCallback((location: LocationItem) => {
    setDeleteConfirmLocation(location);
  }, []);

  useEffect(() => {
    if (!deleteConfirmLocation) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDeleteConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteConfirmLocation, closeDeleteConfirm]);

  useEffect(() => {
    if (pendingMapPoi) {
      setAddPlacementMode(false);
    }
  }, [pendingMapPoi]);

  useEffect(() => {
    if (!addPlacementMode) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddPlacementMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addPlacementMode]);

  useEffect(() => {
    const scheduleHint = (message: string) => {
      queueMicrotask(() => setGeoHint(message));
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      scheduleHint("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        queueMicrotask(() => setGeoHint(""));
      },
      () => {
        scheduleHint("ยังไม่ได้รับตำแหน่งปัจจุบัน — กด เส้นทาง จะขออนุญาตอีกครั้ง");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }, []);

  const filteredLocations = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return locations;
    }

    return locations.filter((location) => {
      return (
        location.name_th.toLowerCase().includes(keyword) ||
        location.type.toLowerCase().includes(keyword) ||
        location.address.toLowerCase().includes(keyword)
      );
    });
  }, [locations, searchQuery]);

  const handleAddLocation = async (payload: NewLocationInput) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase is not configured");
    }

    const { data, error } = await supabase
      .from("locations")
      .insert(payload)
      .select("id,name_th,type,address,lat,lng,created_at")
      .single();

    if (error || !data) {
      throw error ?? new Error("Insert failed");
    }

    const newItem: LocationItem = {
      ...data,
      lat: Number(data.lat),
      lng: Number(data.lng),
    };

    setLocations((prev) => [newItem, ...prev]);
    setSelectedLocationId(newItem.id);
    setSearchQuery("");
    setErrorMessage("");
    setIsAddOpen(false);
    setAddFormCoords(null);
    setAddPlacementMode(false);
  };

  const handleFloatingAddClick = async () => {
    if (!pendingMapPoi) {
      if (addPlacementMode) {
        const c = mapViewRef.current?.getCenter();
        setAddPlacementMode(false);
        if (c) {
          setAddFormCoords(c);
        } else {
          setAddFormCoords(null);
        }
        setAddFormNonce((n) => n + 1);
        setIsAddOpen(true);
        return;
      }
      setAddPlacementMode(true);
      return;
    }

    if (!googleMapsApiKey) {
      setErrorMessage("ไม่พบ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      return;
    }

    setIsSavingFromMapPoi(true);
    setErrorMessage("");
    setMapSaveNotice("");
    try {
      let payload: NewLocationInput;
      let usedPlacesFallback = false;
      try {
        payload = await fetchPlaceForNewLocation(pendingMapPoi);
      } catch {
        payload = minimalLocationFromMapPoi(pendingMapPoi);
        usedPlacesFallback = true;
      }

      await handleAddLocation(payload);
      setPendingMapPoi(null);
      if (usedPlacesFallback) {
        setMapSaveNotice(
          "บันทึกพิกัดแล้ว — ยังดึงชื่อจาก Google ไม่ได้ เปิด Places API (New) หรือ Geocoding API ให้คีย์เดียวกับแผนที่ แล้วลองใหม่ หรือแก้ชื่อในรายการ",
        );
      }
    } catch {
      setErrorMessage("บันทึกลงฐานข้อมูลไม่สำเร็จ — ตรวจสอบ Supabase หรือลองใหม่");
    } finally {
      setIsSavingFromMapPoi(false);
    }
  };

  const confirmDeleteLocation = async () => {
    if (!deleteConfirmLocation) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("ยังไม่ได้ตั้งค่า Supabase");
      return;
    }
    const id = deleteConfirmLocation.id;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) {
        throw error;
      }
      setLocations((prev) => prev.filter((l) => l.id !== id));
      setSelectedLocationId((prev) => (prev === id ? null : prev));
      setPendingMapPoi(null);
      setMapSaveNotice("");
      setDeleteConfirmLocation(null);
    } catch {
      setErrorMessage(
        "ลบข้อมูลไม่สำเร็จ — ตรวจสอบ Supabase (ต้องมีนโยบาย DELETE สำหรับตาราง locations) หรือลองใหม่",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main ref={pageRootRef} className={styles.page}>
      <MapView
        ref={mapViewRef}
        factoryLocation={factoryLocation}
        locations={filteredLocations}
        selectedLocationId={selectedLocationId}
        onMarkerSelect={handleMarkerSelect}
        onClearListSelection={clearListSelection}
        onPendingPoiChange={setPendingMapPoi}
        userPosition={userPosition}
        placementModeActive={addPlacementMode}
        fullscreenContainerRef={pageRootRef}
      />

      {addPlacementMode ? (
        <div className={styles.placementModeBanner} role="status" aria-live="polite">
          ลากหรือซูมแผนที่ให้หมุดแดงกลางจอชี้ตำแหน่งที่ต้องการ แล้วกดปุ่ม + อีกครั้งเพื่อเปิดฟอร์ม · กด Esc
          เพื่อยกเลิก
        </div>
      ) : pendingMapPoi ? (
        <div className={styles.pendingPoiBanner} role="status" aria-live="polite">
          เลือกสถานที่บนแผนที่แล้ว — กดปุ่ม + มุมล่างขวาเพื่อบันทึกลงรายการของคุณ
        </div>
      ) : null}

      <aside className={styles.floatingSidebar}>
        <LocationSidebar
          locations={filteredLocations}
          selectedId={selectedLocationId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSelectLocation={handleSidebarSelectLocation}
          onRequestDelete={handleRequestDelete}
        />
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
        {mapSaveNotice ? <p className={styles.geoHint}>{mapSaveNotice}</p> : null}
        {geoHint ? <p className={styles.geoHint}>{geoHint}</p> : null}
      </aside>

      <button
        className={`${styles.floatingAddButton}${
          pendingMapPoi || addPlacementMode ? ` ${styles.floatingAddButtonReady}` : ""
        }`}
        type="button"
        onClick={() => void handleFloatingAddClick()}
        disabled={isSavingFromMapPoi}
        title={
          pendingMapPoi
            ? "บันทึกจุดนี้ลงรายการ"
            : addPlacementMode
              ? "ยืนยันตำแหน่งและเปิดฟอร์ม"
              : "เลือกตำแหน่งบนแผนที่"
        }
        aria-label={
          pendingMapPoi
            ? "บันทึกสถานที่จากจุดที่คลิกบนแผนที่ลงรายการ"
            : addPlacementMode
              ? "ยืนยันตำแหน่งหมุดแดงกลางจอ แล้วเปิดฟอร์มกรอกชื่อและรายละเอียด กด Esc เพื่อยกเลิก"
              : "เริ่มเลือกตำแหน่ง ลากแผนที่ให้หมุดแดงชี้จุดที่ต้องการ แล้วกดปุ่มนี้อีกครั้งเพื่อเปิดฟอร์ม กด Esc เพื่อยกเลิก"
        }
      >
        {isSavingFromMapPoi ? (
          <span className={styles.floatingAddSaving} aria-hidden>
            …
          </span>
        ) : (
          <svg
            className={styles.floatingAddSvg}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M12 3.5v17M3.5 12h17"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {isAddOpen ? (
        <div className={styles.modalBackdrop} onClick={closeAddModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <AddLocationForm
              key={addFormNonce}
              onSubmitLocation={handleAddLocation}
              initialLat={addFormCoords?.lat}
              initialLng={addFormCoords?.lng}
            />
          </div>
        </div>
      ) : null}

      {deleteConfirmLocation ? (
        <div
          className={styles.modalBackdrop}
          onClick={closeDeleteConfirm}
          role="presentation"
        >
          <div
            className={styles.deleteConfirmCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <h2 id="delete-confirm-title" className={styles.deleteConfirmTitle}>
              ลบสถานที่นี้?
            </h2>
            <p className={styles.deleteConfirmText}>
              จะลบ “{deleteConfirmLocation.name_th}” ออกจากรายการและแผนที่ถาวร
              การกระทำนี้ย้อนกลับไม่ได้
            </p>
            <div className={styles.deleteConfirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeDeleteConfirm}
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void confirmDeleteLocation()}
                disabled={isDeleting}
              >
                {isDeleting ? "กำลังลบ..." : "ลบ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

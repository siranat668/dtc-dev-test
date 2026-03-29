"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddLocationForm from "./AddLocationForm";
import EditLocationForm from "./EditLocationForm";
import LocationSidebar from "./LocationSidebar";
import MapView, { type MapViewHandle } from "./MapView";
import styles from "./MapApp.module.css";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  fetchPlaceForNewLocation,
  minimalLocationFromMapPoi,
} from "@/lib/fetchPlaceForNewLocation";
import type {
  FactoryLocation,
  LocationItem,
  NewLocationInput,
  PendingMapPoi,
  UpdateLocationTextInput,
} from "@/lib/types";

//ตำแหน่งจุดกึ่งกลางจอ
const FACTORY_LOCATION: FactoryLocation = {
  //ตำแหน่งอ้างอิงจากรูปตัวอย่าง
  lat: 13.67393,
  lng: 100.61104,
};

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
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [errorMessage, setErrorMessage] = useState(
    initialLocations.length === 0 ? "ยังไม่มีข้อมูลสถานที่ หรือยังไม่ได้ตั้งค่า Supabase" : "",
  );
  const [addModeMenuOpen, setAddModeMenuOpen] = useState(false);
  const [poiPickMode, setPoiPickMode] = useState(false);
  const [poiConfirmDetail, setPoiConfirmDetail] = useState<{ name: string; loading: boolean }>({
    name: "",
    loading: false,
  });

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const clearListSelection = useCallback(() => {
    setSelectedLocationId(null);
  }, []);

  const handleMarkerSelect = useCallback((locationId: string) => {
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setAddPlacementMode(false);
    setPoiPickMode(false);
    setAddModeMenuOpen(false);
    setSelectedLocationId(locationId);
  }, []);

  const handleSidebarSelectLocation = useCallback((locationId: string) => {
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setAddPlacementMode(false);
    setPoiPickMode(false);
    setAddModeMenuOpen(false);
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

  const closeEditModal = useCallback(() => {
    setEditingLocation(null);
  }, []);

  const handleRequestEdit = useCallback((location: LocationItem) => {
    setEditingLocation(location);
  }, []);

  useEffect(() => {
    if (!editingLocation) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeEditModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingLocation, closeEditModal]);

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
    if (!addModeMenuOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddModeMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addModeMenuOpen]);

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
    setPoiPickMode(false);
  };

  const startPlacementMode = useCallback(() => {
    setAddModeMenuOpen(false);
    setPoiPickMode(false);
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setErrorMessage("");
    setAddPlacementMode(true);
  }, []);

  const startPoiPickMode = useCallback(() => {
    setAddModeMenuOpen(false);
    setAddPlacementMode(false);
    setPendingMapPoi(null);
    setMapSaveNotice("");
    setErrorMessage("");
    setPoiPickMode(true);
  }, []);

  const handlePlacementConfirm = useCallback(() => {
    const c = mapViewRef.current?.getCenter();
    setAddPlacementMode(false);
    if (c) {
      setAddFormCoords(c);
    } else {
      setAddFormCoords(null);
    }
    setAddFormNonce((n) => n + 1);
    setIsAddOpen(true);
  }, []);

  useEffect(() => {
    if (!pendingMapPoi || !poiPickMode) {
      setPoiConfirmDetail({ name: "", loading: false });
      return;
    }
    setPoiConfirmDetail({ name: "", loading: true });
    let cancelled = false;
    void fetchPlaceForNewLocation(pendingMapPoi)
      .then((d) => {
        if (!cancelled) {
          setPoiConfirmDetail({ name: d.name_th, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoiConfirmDetail({ name: "สถานที่", loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pendingMapPoi, poiPickMode]);

  const cancelPoiConfirmModal = useCallback(() => {
    setPendingMapPoi(null);
    setPoiConfirmDetail({ name: "", loading: false });
  }, []);

  useEffect(() => {
    if (!poiPickMode) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      if (pendingMapPoi) {
        setPendingMapPoi(null);
        setPoiConfirmDetail({ name: "", loading: false });
      } else {
        setPoiPickMode(false);
        setMapSaveNotice("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [poiPickMode, pendingMapPoi]);

  const confirmPoiAddFromModal = async () => {
    if (!pendingMapPoi) {
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

  const handleMainFabClick = async () => {
    if (isSavingFromMapPoi) {
      return;
    }
    if (isAddOpen) {
      return;
    }

    if (addPlacementMode) {
      setAddPlacementMode(false);
      setAddModeMenuOpen(true);
      return;
    }

    if (poiPickMode) {
      setPoiPickMode(false);
      setPendingMapPoi(null);
      setAddModeMenuOpen(true);
      return;
    }

    setAddModeMenuOpen((v) => !v);
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
      const { data: deletedRows, error } = await supabase
        .from("locations")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) {
        throw error;
      }
      if (!deletedRows?.length) {
        setErrorMessage(
          "ลบไม่สำเร็จ — ฐานข้อมูลไม่ลบแถว (มักเกิดจากยังไม่มีนโยบาย DELETE บนตาราง locations ใน Supabase ให้รัน policy ใน supabase/schema.sql)",
        );
        return;
      }
      setLocations((prev) => prev.filter((l) => l.id !== id));
      setSelectedLocationId((prev) => (prev === id ? null : prev));
      setPendingMapPoi(null);
      setMapSaveNotice("");
      setDeleteConfirmLocation(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        `ลบข้อมูลไม่สำเร็จ — ตรวจสอบนโยบาย DELETE บน Supabase หรือลองใหม่ (${detail})`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveLocationEdit = async (payload: UpdateLocationTextInput) => {
    if (!editingLocation) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase is not configured");
    }
    const id = editingLocation.id;
    const { data, error } = await supabase
      .from("locations")
      .update({
        name_th: payload.name_th,
        type: payload.type,
        address: payload.address,
      })
      .eq("id", id)
      .select("id,name_th,type,address,lat,lng,created_at")
      .single();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("Update returned no row");
    }

    const updated: LocationItem = {
      ...data,
      lat: Number(data.lat),
      lng: Number(data.lng),
    };

    setLocations((prev) => prev.map((l) => (l.id === id ? updated : l)));
    setEditingLocation(null);
    setErrorMessage("");
  };

  return (
    <main ref={pageRootRef} className={styles.page}>
      <div className={styles.brandLogoWrap}>
        <img
          className={styles.brandLogo}
          src="/dtc-logo.png"
          alt="DTC"
          width={220}
          height={110}
          decoding="async"
        />
      </div>
      <MapView
        ref={mapViewRef}
        factoryLocation={FACTORY_LOCATION}
        locations={filteredLocations}
        selectedLocationId={selectedLocationId}
        onMarkerSelect={handleMarkerSelect}
        onClearListSelection={clearListSelection}
        onPendingPoiChange={setPendingMapPoi}
        userPosition={userPosition}
        placementModeActive={addPlacementMode}
        onPlacementConfirm={handlePlacementConfirm}
        poiPickMode={poiPickMode}
        fullscreenContainerRef={pageRootRef}
      />

      {addPlacementMode ? (
        <div className={styles.placementModeBanner} role="status" aria-live="polite">
          <strong>โหมดเลือกตำแหน่งบนแผนที่</strong>
          {" — "}
          ลากหรือซูมแผนที่ให้หมุดสีแดงกลางจอชี้ตำแหน่งที่ต้องการ
          <br />
          แล้วกดปุ่ม {" — "}
          <strong>เพิ่มข้อมูลตำแหน่งนี้</strong> บนหมุดเพื่อเปิดฟอร์ม · กด Esc เพื่อยกเลิก
        </div>
      ) : poiPickMode ? (
        <div className={styles.poiPickModeBanner} role="status" aria-live="polite">
          <strong>โหมดเลือกจากหมุดบนแผนที่</strong>
          {" — "}
          กรุณาคลิกไอคอนสถานที่บนแผนที่ และกดปุ่มยืนยัน
          <br />
          กด Esc เพื่อยกเลิก
        </div>
      ) : null}

      <aside className={styles.floatingSidebar}>
        <LocationSidebar
          locations={filteredLocations}
          selectedId={selectedLocationId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSelectLocation={handleSidebarSelectLocation}
          onRequestEdit={handleRequestEdit}
          onRequestDelete={handleRequestDelete}
        />
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
        {mapSaveNotice ? <p className={styles.geoHint}>{mapSaveNotice}</p> : null}
        {geoHint ? <p className={styles.geoHint}>{geoHint}</p> : null}
      </aside>

      {addModeMenuOpen &&
      !pendingMapPoi &&
      !addPlacementMode &&
      !poiPickMode &&
      !isAddOpen ? (
        <div
          className={styles.floatingAddMenuBackdrop}
          onClick={() => setAddModeMenuOpen(false)}
          role="presentation"
          aria-hidden
        />
      ) : null}

      <div className={styles.floatingAddDock}>
        {addModeMenuOpen &&
        !pendingMapPoi &&
        !addPlacementMode &&
        !poiPickMode &&
        !isAddOpen ? (
          <div
            className={styles.floatingAddMenu}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-mode-menu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="add-mode-menu-title" className={styles.floatingAddMenuTitle}>
              เพิ่มสถานที่ใหม่
            </p>
            <p className={styles.floatingAddMenuSubtitle}>เลือกวิธีเพิ่มข้อมูลตำแหน่ง</p>
            <button
              type="button"
              className={styles.floatingAddMenuCard}
              onClick={startPlacementMode}
            >
              <span
                className={`${styles.floatingAddMenuCardIcon} ${styles.floatingAddMenuCardIconPlacement}`}
                aria-hidden
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="9" r="2.25" fill="currentColor" />
                </svg>
              </span>
              <span className={styles.floatingAddMenuCardBody}>
                <span className={styles.floatingAddMenuCardTitle}>เลือกตำแหน่งจากแผนที่</span>
                <span className={styles.floatingAddMenuCardDesc}>
                  ลากหรือซูมแผนที่ให้หมุดสีแดงกลางจอชี้ตำแหน่งที่ต้องการ แล้วกดข้อความบนหมุดเพื่อกรอกข้อมูล
                </span>
              </span>
            </button>
            <button
              type="button"
              className={styles.floatingAddMenuCard}
              onClick={startPoiPickMode}
            >
              <span
                className={`${styles.floatingAddMenuCardIcon} ${styles.floatingAddMenuCardIconPoi}`}
                aria-hidden
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="9" r="2.25" fill="currentColor" />
                </svg>
              </span>
              <span className={styles.floatingAddMenuCardBody}>
                <span className={styles.floatingAddMenuCardTitle}>จากไอคอนสถานที่บน Google Maps</span>
                <span className={styles.floatingAddMenuCardDesc}>
                  คลิกไอคอนสถานที่บนแผนที่ แล้วยืนยันในหน้าต่างเพื่อดึงชื่อและพิกัดมาบันทึก
                </span>
              </span>
            </button>
          </div>
        ) : null}

        <button
          className={`${styles.floatingAddButton}${
            !addPlacementMode && !poiPickMode && !addModeMenuOpen
              ? ` ${styles.floatingAddButtonIdleGreen}`
              : ""
          }${addModeMenuOpen ? ` ${styles.floatingAddButtonMenuOpen}` : ""}`}
          type="button"
          onClick={() => void handleMainFabClick()}
          disabled={isSavingFromMapPoi}
          title={
            addPlacementMode
              ? "เปิดเมนูเลือกโหมด (ออกจากโหมดเลือกตำแหน่ง)"
              : poiPickMode
                ? "เปิดเมนูเลือกโหมด (ออกจากโหมดคลิกสถานที่)"
                : "เพิ่มสถานที่ — เลือกโหมด"
          }
          aria-label={
            addPlacementMode
              ? "เปิดเมนูเลือกโหมดการเพิ่มสถานที่ หรือกด Esc เพื่อยกเลิกโหมดเลือกตำแหน่ง"
              : poiPickMode
                ? "เปิดเมนูเลือกโหมดการเพิ่มสถานที่ หรือกด Esc เพื่อยกเลิกโหมดคลิกสถานที่"
                : "เปิดเมนูเพิ่มสถานที่ — เลือกโหมดจากแผนที่หรือจากไอคอนบนแผนที่"
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
      </div>

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

      {pendingMapPoi && poiPickMode ? (
        <div
          className={styles.modalBackdrop}
          onClick={cancelPoiConfirmModal}
          role="presentation"
        >
          <div
            className={styles.deleteConfirmCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="poi-confirm-title"
          >
            <h2 id="poi-confirm-title" className={styles.deleteConfirmTitle}>
              ยืนยันการเพิ่มสถานที่
            </h2>
            <p className={styles.deleteConfirmText}>
              {poiConfirmDetail.loading ? (
                "กำลังโหลดชื่อสถานที่..."
              ) : (
                <>
                  เพิ่ม &ldquo;{poiConfirmDetail.name}&rdquo; ไปยังรายการที่บันทึกหรือไม่?
                </>
              )}
            </p>
            <div className={styles.deleteConfirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={cancelPoiConfirmModal}
                disabled={isSavingFromMapPoi}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void confirmPoiAddFromModal()}
                disabled={isSavingFromMapPoi || poiConfirmDetail.loading}
              >
                {isSavingFromMapPoi ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingLocation ? (
        <div className={styles.modalBackdrop} onClick={closeEditModal} role="presentation">
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <EditLocationForm
              key={editingLocation.id}
              location={editingLocation}
              onSave={handleSaveLocationEdit}
              onCancel={closeEditModal}
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

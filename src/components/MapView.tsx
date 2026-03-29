"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import styles from "./MapApp.module.css";
import { fetchPlaceForNewLocation } from "@/lib/fetchPlaceForNewLocation";
import type { FactoryLocation, LocationItem, PendingMapPoi } from "@/lib/types";

export type MapViewHandle = {
  getCenter: () => google.maps.LatLngLiteral | null;
};

type MapViewProps = {
  factoryLocation: FactoryLocation;
  locations: LocationItem[];
  selectedLocationId: string | null;
  onMarkerSelect: (locationId: string) => void;
  onClearListSelection?: () => void;
  onPendingPoiChange: (poi: PendingMapPoi | null) => void;
  userPosition: { lat: number; lng: number } | null;
  /** โหมดเลือกจุด: หมุดแดงกลางจอ — ลากแผนที่แล้วกด + อีกครั้งเพื่อยืนยันพิกัด */
  placementModeActive?: boolean;
  /**
   * ถ้ามี: ปิด fullscreen เริ่มต้นของแผนที่ แล้วใส่ปุ่มเต็มจอที่ครอบ element นี้ทั้งก้อน
   * (รายการซ้าย + ปุ่ม + ฯลฯ) แทนการเต็มจอแค่ div แผนที่
   */
  fullscreenContainerRef?: RefObject<HTMLElement | null>;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStyledInfoWindowHtml(iwId: string, title: string): string {
  const safeTitle = escapeHtml(title);
  return `<div id="${iwId}" style="font-family:var(--font-kanit),ui-sans-serif,sans-serif;box-sizing:border-box;width:100%;min-width:188px;max-width:288px;margin:0 auto;padding:14px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px">
          <div style="margin:0;padding:0;width:100%;font-weight:600;color:#111;font-size:0.9375rem;line-height:1.35;text-align:center;word-wrap:break-word;overflow-wrap:break-word">${safeTitle}</div>
          <a href="#" id="${iwId}-dir" style="margin:0;padding:0;line-height:1.35;color:#1a73e8;font-size:0.875rem;font-weight:500;text-decoration:none;cursor:pointer;text-align:center">เส้นทาง</a>
        </div>`;
}

/** หมุดสถานที่: หัวเป็นแหวนน้ำเงินหนา กลางโปร่งเห็นแผนที่ */
function locationPinIconUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
  <defs>
    <filter id="p" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-opacity="0.22"/>
    </filter>
    <mask id="ph">
      <rect width="48" height="64" fill="white"/>
      <circle cx="24" cy="23" r="9.25" fill="black"/>
    </mask>
  </defs>
  <path d="M24 2C12.42 2 3 11.2 3 22.6c0 12.8 19.2 37.9 20.25 39.35a1.8 1.8 0 0 0 1.5.85c.6 0 1.15-.3 1.5-.85C27.3 60.5 45 35.4 45 22.6 45 11.2 35.58 2 24 2z"
    fill="#2563EB" stroke="#1d4ed8" stroke-width="1.25" filter="url(#p)" mask="url(#ph)"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const PIN_W = 40;
const PIN_H = Math.round((64 / 48) * 40);
const PIN_ANCHOR_X = PIN_W / 2;
const PIN_ANCHOR_Y = PIN_H;
/** ยก InfoWindow ให้ห่างจากหมุดสถานที่ของเรา (anchor อยู่ปลายหมุด) */
const OWN_MARKER_INFO_OFFSET_Y = -Math.round(PIN_H * 0.12);

type UserPulseClasses = {
  root: string;
  white: string;
  blue: string;
};

type UserPulseOverlayInstance = google.maps.OverlayView & {
  setPosition: (pos: google.maps.LatLngLiteral) => void;
};

let userPulseOverlayClass: (new (
  position: google.maps.LatLngLiteral,
  classes: UserPulseClasses,
) => UserPulseOverlayInstance) | null = null;

function createUserPulseOverlay(
  position: google.maps.LatLngLiteral,
  map: google.maps.Map,
  classes: UserPulseClasses,
): UserPulseOverlayInstance {
  if (typeof google === "undefined") {
    throw new Error("Google Maps ยังไม่พร้อม");
  }

  if (!userPulseOverlayClass) {
    const ANCHOR_PX = 16;
    const HALF = ANCHOR_PX / 2;

    userPulseOverlayClass = class extends google.maps.OverlayView implements UserPulseOverlayInstance {
      private latLng: google.maps.LatLng;
      private readonly rootEl: HTMLDivElement;

      constructor(pos: google.maps.LatLngLiteral, c: UserPulseClasses) {
        super();
        this.latLng = new google.maps.LatLng(pos);
        const root = document.createElement("div");
        root.className = c.root;
        const whiteEl = document.createElement("div");
        whiteEl.className = c.white;
        const blueEl = document.createElement("div");
        blueEl.className = c.blue;
        whiteEl.appendChild(blueEl);
        root.appendChild(whiteEl);
        this.rootEl = root;
      }

      onAdd(): void {
        this.getPanes()?.overlayMouseTarget.appendChild(this.rootEl);
      }

      draw(): void {
        const projection = this.getProjection();
        if (!projection) {
          return;
        }
        const point = projection.fromLatLngToDivPixel(this.latLng);
        if (!point) {
          return;
        }
        this.rootEl.style.left = `${Math.round(point.x - HALF)}px`;
        this.rootEl.style.top = `${Math.round(point.y - HALF)}px`;
      }

      onRemove(): void {
        this.rootEl.remove();
      }

      setPosition(pos: google.maps.LatLngLiteral): void {
        this.latLng = new google.maps.LatLng(pos);
        this.draw();
      }
    };
  }

  const overlay = new userPulseOverlayClass(position, classes);
  overlay.setMap(map);
  return overlay;
}

function isIconMouseEventWithPlace(
  e: google.maps.MapMouseEvent,
): e is google.maps.IconMouseEvent & { placeId: string } {
  const pe = e as google.maps.IconMouseEvent;
  return typeof pe.placeId === "string" && pe.placeId.length > 0;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    factoryLocation,
    locations,
    selectedLocationId,
    onMarkerSelect,
    onClearListSelection,
    onPendingPoiChange,
    userPosition,
    placementModeActive = false,
    fullscreenContainerRef,
  },
  ref,
) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const locationMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userPulseOverlayRef = useRef<UserPulseOverlayInstance | null>(null);
  const poiClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  /** กันคลิกแผนที่ปิด InfoWindow ทันทีหลังคลิกหมุด (บางเบราว์เซอร์ยิง map click ต่อท้าย) */
  const suppressMapClickCloseRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const userCenteredOnceRef = useRef(false);
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(userPosition);
  const [mapError, setMapError] = useState("");

  useImperativeHandle(ref, () => ({
    getCenter: () => {
      const map = mapRef.current;
      if (!map) {
        return null;
      }
      const c = map.getCenter();
      if (!c) {
        return null;
      }
      return { lat: c.lat(), lng: c.lng() };
    },
  }));

  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const pinIconUrl = useMemo(() => locationPinIconUrl(), []);

  const userPulseClasses = useMemo(
    () => ({
      root: styles.userPulseRoot,
      white: styles.userPulseWhite,
      blue: styles.userPulseBlue,
    }),
    [],
  );

  const bindDirectionsLink = useCallback((iwId: string, dest: google.maps.LatLngLiteral) => {
    const link = document.getElementById(`${iwId}-dir`);
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      const directionsService = directionsServiceRef.current;
      const directionsRenderer = directionsRendererRef.current;
      if (!directionsService || !directionsRenderer) {
        return;
      }

      const runRoute = (origin: google.maps.LatLngLiteral) => {
        directionsService.route(
          {
            origin,
            destination: dest,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);
              return;
            }
            directionsRenderer.set("directions", null);
            window.alert("ไม่สามารถคำนวณเส้นทางได้ กรุณาลองอีกครั้ง");
          },
        );
      };

      const cached = userPositionRef.current;
      if (cached) {
        runRoute(cached);
        return;
      }

      if (!navigator.geolocation) {
        window.alert("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          runRoute({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          window.alert("ต้องอนุญาตให้เข้าถึงตำแหน่งปัจจุบันเพื่อแสดงเส้นทาง");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
  }, []);

  const bindDirectionsLinkRef = useRef(bindDirectionsLink);
  useEffect(() => {
    bindDirectionsLinkRef.current = bindDirectionsLink;
  }, [bindDirectionsLink]);

  const openStyledInfoWindowRef = useRef<
    | ((options: {
        iwId: string;
        title: string;
        map: google.maps.Map;
        anchor: google.maps.Marker | null;
        position: google.maps.LatLngLiteral;
        dest: google.maps.LatLngLiteral;
      }) => void)
    | null
  >(null);

  const onClearListSelectionRef = useRef(onClearListSelection);
  const onPendingPoiChangeRef = useRef(onPendingPoiChange);

  const openStyledInfoWindow = useCallback(
    (options: {
      iwId: string;
      title: string;
      map: google.maps.Map;
      anchor: google.maps.Marker | null;
      position: google.maps.LatLngLiteral;
      dest: google.maps.LatLngLiteral;
    }) => {
      const { iwId, title, map, anchor, position, dest } = options;
      const infoWindow = infoWindowRef.current;
      if (!infoWindow) {
        return;
      }

      /* ยกกล่องขึ้น: หมุดของเราใช้ offset ตามความสูงหมุด, POI ใช้ค่าคงที่ */
      infoWindow.setOptions({
        pixelOffset: anchor
          ? new google.maps.Size(0, OWN_MARKER_INFO_OFFSET_Y)
          : new google.maps.Size(0, -32),
      });

      infoWindow.setContent(buildStyledInfoWindowHtml(iwId, title));

      if (anchor) {
        infoWindow.open({ map, anchor });
      } else {
        infoWindow.setPosition(position);
        infoWindow.open({ map });
      }

      google.maps.event.addListenerOnce(infoWindow, "domready", () => {
        bindDirectionsLink(iwId, dest);
      });
    },
    [bindDirectionsLink],
  );

  useEffect(() => {
    onClearListSelectionRef.current = onClearListSelection;
  }, [onClearListSelection]);

  useEffect(() => {
    onPendingPoiChangeRef.current = onPendingPoiChange;
  }, [onPendingPoiChange]);

  useEffect(() => {
    openStyledInfoWindowRef.current = openStyledInfoWindow;
  }, [openStyledInfoWindow]);

  const openInfoWindowForLocation = useCallback(
    (location: LocationItem, marker: google.maps.Marker) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const iwId = `gm-loc-${location.id.replace(/[^a-zA-Z0-9-]/g, "")}`;
      const dest = { lat: location.lat, lng: location.lng };

      openStyledInfoWindow({
        iwId,
        title: location.name_th,
        map,
        anchor: marker,
        position: dest,
        dest,
      });
    },
    [openStyledInfoWindow],
  );

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let isMounted = true;
    let pageFullscreenControlWrap: HTMLDivElement | null = null;
    let onPageFullscreenChange: (() => void) | null = null;

    const setupMap = async () => {
      try {
        setOptions({
          key: apiKey,
          v: "weekly",
        });
        await importLibrary("maps");
        if (!isMounted || !mapElementRef.current) {
          return;
        }

        const fsTarget = fullscreenContainerRef?.current ?? null;

        const initialCenter = {
          lat: factoryLocation.lat,
          lng: factoryLocation.lng,
        };

        const map = new google.maps.Map(mapElementRef.current, {
          center: initialCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          rotateControl: false,
          zoomControl: false,
          cameraControl: false,
          fullscreenControl: !fsTarget,
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          clickableIcons: true,
        });

        if (fsTarget) {
          pageFullscreenControlWrap = document.createElement("div");
          pageFullscreenControlWrap.className = styles.mapPageFullscreenWrap;
          const fsBtn = document.createElement("button");
          fsBtn.type = "button";
          fsBtn.className = styles.mapPageFullscreenBtn;
          fsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

          const syncFsUi = () => {
            const active = document.fullscreenElement === fsTarget;
            fsBtn.title = active ? "ออกจากโหมดเต็มจอ" : "แสดงแบบเต็มจอ";
            fsBtn.setAttribute("aria-label", fsBtn.title);
          };

          onPageFullscreenChange = () => syncFsUi();
          document.addEventListener("fullscreenchange", onPageFullscreenChange);
          syncFsUi();

          fsBtn.addEventListener("click", () => {
            void (async () => {
              try {
                if (document.fullscreenElement === fsTarget) {
                  await document.exitFullscreen();
                } else {
                  await fsTarget.requestFullscreen();
                }
              } catch {
                /* เช่น iOS / นโยบายเบราว์เซอร์ */
              }
            })();
          });

          pageFullscreenControlWrap.appendChild(fsBtn);
          map.controls[google.maps.ControlPosition.TOP_RIGHT].push(pageFullscreenControlWrap);
        }

        const infoWindow = new google.maps.InfoWindow({
          disableAutoPan: false,
          headerDisabled: true,
          maxWidth: 320,
          ariaLabel: "ข้อมูลสถานที่",
        });

        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeWeight: 5,
            clickable: false,
          },
        });

        directionsRenderer.setMap(map);

        mapRef.current = map;
        infoWindowRef.current = infoWindow;
        directionsServiceRef.current = directionsService;
        directionsRendererRef.current = directionsRenderer;

        poiClickListenerRef.current?.remove();
        poiClickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (isIconMouseEventWithPlace(e) && e.latLng) {
            e.stop();
            suppressMapClickCloseRef.current = true;
            window.setTimeout(() => {
              suppressMapClickCloseRef.current = false;
            }, 280);

            directionsRenderer.set("directions", null);
            onClearListSelectionRef.current?.();
            onPendingPoiChangeRef.current({
              placeId: e.placeId,
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            });

            const dest = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            const poiSlug = e.placeId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 56);
            const iwId = `gm-poi-${poiSlug || "p"}`;

            openStyledInfoWindowRef.current?.({
              iwId,
              title: "สถานที่",
              map,
              anchor: null,
              position: dest,
              dest,
            });

            void (async () => {
              try {
                const detail = await fetchPlaceForNewLocation({
                  placeId: e.placeId,
                  lat: dest.lat,
                  lng: dest.lng,
                });
                const iw = infoWindowRef.current;
                if (!iw || !mapRef.current) {
                  return;
                }
                iw.setContent(buildStyledInfoWindowHtml(iwId, detail.name_th));
                google.maps.event.addListenerOnce(iw, "domready", () => {
                  bindDirectionsLinkRef.current(iwId, dest);
                });
              } catch {
                /* คงชื่อ "สถานที่" */
              }
            })();

            return;
          }
          if (suppressMapClickCloseRef.current) {
            return;
          }
          onPendingPoiChangeRef.current(null);
          infoWindow.close();
        });
      } catch {
        setMapError("โหลด Google Maps ไม่สำเร็จ");
      }
    };

    void setupMap();

    return () => {
      isMounted = false;
      if (onPageFullscreenChange) {
        document.removeEventListener("fullscreenchange", onPageFullscreenChange);
      }
      const m = mapRef.current;
      if (m && pageFullscreenControlWrap) {
        const topRight = m.controls[google.maps.ControlPosition.TOP_RIGHT];
        const idx = topRight.getArray().indexOf(pageFullscreenControlWrap);
        if (idx >= 0) {
          topRight.removeAt(idx);
        }
      }
      pageFullscreenControlWrap = null;
      onPageFullscreenChange = null;
      userPulseOverlayRef.current?.setMap(null);
      userPulseOverlayRef.current = null;
      poiClickListenerRef.current?.remove();
      poiClickListenerRef.current = null;
      directionsRendererRef.current?.setMap(null);
      directionsRendererRef.current = null;
      directionsServiceRef.current = null;
    };
  }, [apiKey, factoryLocation.lat, factoryLocation.lng, fullscreenContainerRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition || userCenteredOnceRef.current) {
      return;
    }
    map.panTo(userPosition);
    const z = map.getZoom();
    if (z !== undefined && z < 13) {
      map.setZoom(13);
    }
    userCenteredOnceRef.current = true;
  }, [userPosition]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const nextIds = new Set(locations.map((item) => item.id));

    for (const [locationId, marker] of locationMarkersRef.current.entries()) {
      if (!nextIds.has(locationId)) {
        marker.setMap(null);
        locationMarkersRef.current.delete(locationId);
      }
    }

    const pinIcon: google.maps.Icon = {
      url: pinIconUrl,
      scaledSize: new google.maps.Size(PIN_W, PIN_H),
      anchor: new google.maps.Point(PIN_ANCHOR_X, PIN_ANCHOR_Y),
    };

    for (const location of locations) {
      const existingMarker = locationMarkersRef.current.get(location.id);
      if (existingMarker) {
        existingMarker.setPosition({ lat: location.lat, lng: location.lng });
        existingMarker.setIcon(pinIcon);
        existingMarker.setZIndex(1000);
        continue;
      }

      const marker = new google.maps.Marker({
        map,
        position: { lat: location.lat, lng: location.lng },
        title: location.name_th,
        icon: pinIcon,
        optimized: false,
        zIndex: 1000,
      });

      marker.addListener("click", () => {
        suppressMapClickCloseRef.current = true;
        onMarkerSelect(location.id);
        window.setTimeout(() => {
          suppressMapClickCloseRef.current = false;
        }, 250);
      });

      locationMarkersRef.current.set(location.id, marker);
    }

    if (!initialFitDoneRef.current && locations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      if (userPosition) {
        bounds.extend(userPosition);
      }
      locations.forEach((location) => {
        bounds.extend({ lat: location.lat, lng: location.lng });
      });
      map.fitBounds(bounds, 56);
      initialFitDoneRef.current = true;
    }
  }, [factoryLocation.lat, factoryLocation.lng, locations, onMarkerSelect, pinIconUrl, userPosition]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    const map = mapRef.current;

    if (!userPosition) {
      userPulseOverlayRef.current?.setMap(null);
      userPulseOverlayRef.current = null;
      return;
    }

    try {
      if (userPulseOverlayRef.current) {
        userPulseOverlayRef.current.setPosition(userPosition);
        userPulseOverlayRef.current.setMap(map);
        return;
      }

      userPulseOverlayRef.current = createUserPulseOverlay(
        userPosition,
        map,
        userPulseClasses,
      );
    } catch {
      /* maps ยังไม่พร้อม — รอรอบถัดไป */
    }
  }, [userPosition, userPulseClasses]);

  useEffect(() => {
    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    const directionsRenderer = directionsRendererRef.current;

    if (!map || !infoWindow || !directionsRenderer) {
      return;
    }

    if (!selectedLocation) {
      directionsRenderer.set("directions", null);
      infoWindow.close();
      return;
    }

    const selectedMarker = locationMarkersRef.current.get(selectedLocation.id);
    if (!selectedMarker) {
      directionsRenderer.set("directions", null);
      infoWindow.close();
      return;
    }

    directionsRenderer.set("directions", null);
    map.panTo({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    map.setZoom(15);

    openInfoWindowForLocation(selectedLocation, selectedMarker);
  }, [openInfoWindowForLocation, selectedLocation]);

  return (
    <section className={styles.mapSection}>
      {!apiKey ? <p className={styles.errorText}>ไม่พบ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p> : null}
      {mapError ? <p className={styles.errorText}>{mapError}</p> : null}
      <div ref={mapElementRef} className={styles.mapCanvas} />
      {placementModeActive ? (
        <div className={styles.mapPlacementPinWrap} aria-hidden>
          <div className={styles.mapPlacementPin}>
            <svg
              className={styles.mapPlacementPinSvg}
              viewBox="0 0 48 64"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M24 2C12.42 2 3 11.2 3 22.6c0 12.8 19.2 37.9 20.25 39.35a1.8 1.8 0 0 0 1.5.85c.6 0 1.15-.3 1.5-.85C27.3 60.5 45 35.4 45 22.6 45 11.2 35.58 2 24 2z"
                fill="#dc2626"
                stroke="#b91c1c"
                strokeWidth="1.25"
              />
              <circle cx="24" cy="22" r="6" fill="#ffffff" />
            </svg>
          </div>
        </div>
      ) : null}
    </section>
  );
});

export default MapView;

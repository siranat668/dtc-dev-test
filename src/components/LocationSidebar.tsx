"use client";

import styles from "./MapApp.module.css";
import type { LocationItem } from "@/lib/types";

type LocationSidebarProps = {
  locations: LocationItem[];
  selectedId: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectLocation: (locationId: string) => void;
  onRequestEdit: (location: LocationItem) => void;
  onRequestDelete: (location: LocationItem) => void;
};

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LocationSidebar({
  locations,
  selectedId,
  searchQuery,
  onSearchQueryChange,
  onSelectLocation,
  onRequestEdit,
  onRequestDelete,
}: LocationSidebarProps) {
  return (
    <section className={styles.sidebarCard}>
      <div className={styles.searchWrap}>
        <div className={styles.searchField}>
          <span className={styles.searchIcon} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              <path d="M16.5 16.5 21 21" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="ค้นหา.."
            aria-label="ค้นหาสถานที่"
          />
        </div>
      </div>
      <div className={styles.locationList}>
        {locations.length === 0 ? (
          <p className={styles.emptyText}>ไม่พบรายการที่ค้นหา</p>
        ) : (
          locations.map((location) => {
            const isOpen = selectedId === location.id;
            return (
              <div
                key={location.id}
                className={`${styles.locationRow} ${isOpen ? styles.locationRowActive : ""}`}
              >
                <button
                  type="button"
                  className={styles.locationRowHead}
                  onClick={() => onSelectLocation(location.id)}
                  aria-expanded={isOpen}
                >
                  <div className={styles.locationRowMain}>
                    <span className={styles.locationRowTitle}>{location.name_th}</span>
                    <span
                      className={`${styles.rowChevron} ${isOpen ? styles.rowChevronOpen : ""}`}
                      aria-hidden
                    >
                      ›
                    </span>
                  </div>
                </button>
                {isOpen ? (
                  <div className={styles.locationRowDetails}>
                    <dl className={styles.locationDetailList}>
                      <div className={styles.locationDetailRow}>
                        <dt>ชื่อ</dt>
                        <dd>{location.name_th}</dd>
                      </div>
                      <div className={styles.locationDetailRow}>
                        <dt>ประเภท</dt>
                        <dd>{location.type || "—"}</dd>
                      </div>
                      <div className={styles.locationDetailRow}>
                        <dt>ที่อยู่</dt>
                        <dd>{location.address?.trim() ? location.address : "—"}</dd>
                      </div>
                      <div className={styles.locationDetailRow}>
                        <dt>พิกัด</dt>
                        <dd>
                          lat {location.lat.toFixed(6)}, lng {location.lng.toFixed(6)}
                        </dd>
                      </div>
                      <div className={styles.locationDetailRow}>
                        <dt>บันทึกเมื่อ</dt>
                        <dd>{formatCreatedAt(location.created_at)}</dd>
                      </div>
                    </dl>
                    <div className={styles.locationRowActions}>
                      <button
                        type="button"
                        className={styles.editLocationButton}
                        onClick={() => onRequestEdit(location)}
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className={styles.deleteLocationButton}
                        onClick={() => onRequestDelete(location)}
                      >
                        ลบรายการนี้
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

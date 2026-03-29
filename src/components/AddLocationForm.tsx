"use client";

import { type FormEvent, useState } from "react";
import styles from "./MapApp.module.css";
import type { NewLocationInput } from "@/lib/types";

type AddLocationFormProps = {
  onSubmitLocation: (data: NewLocationInput) => Promise<void>;
  initialLat?: number;
  initialLng?: number;
};

const initialFormState = {
  name_th: "",
  type: "",
  address: "",
  lat: "",
  lng: "",
};

function formStateFromInitial(initialLat?: number, initialLng?: number) {
  const latOk = initialLat != null && Number.isFinite(initialLat);
  const lngOk = initialLng != null && Number.isFinite(initialLng);
  return {
    ...initialFormState,
    lat: latOk ? initialLat.toFixed(6) : "",
    lng: lngOk ? initialLng.toFixed(6) : "",
  };
}

export default function AddLocationForm({
  onSubmitLocation,
  initialLat,
  initialLng,
}: AddLocationFormProps) {
  const [formData, setFormData] = useState(() => formStateFromInitial(initialLat, initialLng));
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onChange = (field: keyof typeof initialFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const lat = Number(formData.lat);
    const lng = Number(formData.lng);

    if (!formData.name_th.trim()) {
      setFormError("กรุณากรอกชื่อสถานที่");
      return;
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setFormError("กรุณากรอกพิกัด lat/lng ให้ถูกต้อง");
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setFormError("ค่าพิกัดอยู่นอกช่วงที่ถูกต้อง");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitLocation({
        name_th: formData.name_th.trim(),
        type: formData.type.trim() || "สถานที่ทั่วไป",
        address: formData.address.trim(),
        lat,
        lng,
      });
      setFormData(initialFormState);
      setFormError("");
    } catch {
      setFormError("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>เพิ่มสถานที่ใหม่</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          <span>ชื่อสถานที่ *</span>
          <input
            className={styles.input}
            value={formData.name_th}
            onChange={(e) => onChange("name_th", e.target.value)}
            placeholder="เช่น โรงพยาบาลบางนา"
          />
        </label>

        <label className={styles.label}>
          <span>ประเภท</span>
          <input
            className={styles.input}
            value={formData.type}
            onChange={(e) => onChange("type", e.target.value)}
            placeholder="เช่น โรงพยาบาล"
          />
        </label>

        <label className={styles.label}>
          <span>ที่อยู่</span>
          <input
            className={styles.input}
            value={formData.address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="ระบุที่อยู่โดยย่อ"
          />
        </label>

        <div className={styles.coordinatesRow}>
          <label className={styles.label}>
            <span>Latitude *</span>
            <input
              className={styles.input}
              value={formData.lat}
              onChange={(e) => onChange("lat", e.target.value)}
              placeholder="13.6789123"
            />
          </label>
          <label className={styles.label}>
            <span>Longitude *</span>
            <input
              className={styles.input}
              value={formData.lng}
              onChange={(e) => onChange("lng", e.target.value)}
              placeholder="100.6123456"
            />
          </label>
        </div>

        {formError ? <p className={styles.errorText}>{formError}</p> : null}

        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกสถานที่"}
        </button>
      </form>
    </section>
  );
}

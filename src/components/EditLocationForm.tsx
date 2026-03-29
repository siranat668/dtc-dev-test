"use client";

import { type FormEvent, useState } from "react";
import styles from "./MapApp.module.css";
import type { LocationItem, UpdateLocationTextInput } from "@/lib/types";

type EditLocationFormProps = {
  location: LocationItem;
  onSave: (data: UpdateLocationTextInput) => Promise<void>;
  onCancel: () => void;
};

export default function EditLocationForm({ location, onSave, onCancel }: EditLocationFormProps) {
  const [name_th, setNameTh] = useState(location.name_th);
  const [type, setType] = useState(location.type);
  const [address, setAddress] = useState(location.address);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name_th.trim()) {
      setFormError("กรุณากรอกชื่อสถานที่");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      await onSave({
        name_th: name_th.trim(),
        type: type.trim() || "สถานที่ทั่วไป",
        address: address.trim(),
      });
    } catch {
      setFormError("บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>แก้ไขสถานที่</h2>
      <p className={styles.editLocationHint}>
        แก้ได้เฉพาะชื่อ ประเภท และที่อยู่ — พิกัด lat/lng คงเดิม
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          <span>ชื่อสถานที่ *</span>
          <input
            className={styles.input}
            value={name_th}
            onChange={(e) => {
              setNameTh(e.target.value);
              setFormError("");
            }}
            placeholder="เช่น โรงพยาบาลบางนา"
          />
        </label>

        <label className={styles.label}>
          <span>ประเภท</span>
          <input
            className={styles.input}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setFormError("");
            }}
            placeholder="เช่น โรงพยาบาล"
          />
        </label>

        <label className={styles.label}>
          <span>ที่อยู่</span>
          <input
            className={styles.input}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setFormError("");
            }}
            placeholder="ระบุที่อยู่โดยย่อ"
          />
        </label>

        {formError ? <p className={styles.errorText}>{formError}</p> : null}

        <div className={styles.editFormActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            ยกเลิก
          </button>
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </button>
        </div>
      </form>
    </section>
  );
}

export type LocationItem = {
  id: string;
  name_th: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type NewLocationInput = {
  name_th: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
};

/** หมุด POI ของ Google ที่ผู้ใช้คลิกล่าสุด (สำหรับปุ่ม + บันทึกลง DB) */
export type PendingMapPoi = {
  placeId: string;
  lat: number;
  lng: number;
};

export type FactoryLocation = {
  name: string;
  lat: number;
  lng: number;
};

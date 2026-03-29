# DTC DevTest Siranat.Ta

แอป Next.js: แผนที่ Google + รายการสถานที่จากฐานข้อมูลบน Supabase (เป็น PostgreSQL) — ค้นหา, เส้นทาง, เพิ่ม/แก้ไข/ลบจุด

## การทำงาน

- โหลดข้อมูลครั้งแรก (SSR) : `src/app/page.tsx` — `select` จาก `locations` แล้วส่งเข้า `MapDashboard`
- ฝั่ง client + state หลัก : `src/components/MapDashboard.tsx`
- แผนที่, marker, Directions, POI : `src/components/MapView.tsx`
- ไคลเอนต์ Supabase : `src/lib/supabaseClient.ts`
- ดึงชื่อ/ที่อยู่จาก POI หรือ geocode : `src/lib/fetchPlaceForNewLocation.ts`

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ใน [Supabase](https://supabase.com) แล้วเปิด SQL Editor
2. วางและรันทั้งไฟล์ `supabase/schema.sql`
   - สร้างตาราง `public.locations`: `id` (uuid), `name_th`, `type`, `address`, `lat`, `lng`, `created_at`
   - เปิด RLS และ policy อ่าน/เพิ่ม/แก้/ลบ สำหรับ `anon` + `authenticated` (โปรเจกต์นี้ใช้ anon key จากเบราว์เซอร์)
3. ใน Project Settings → API คัดลอก Project URL และ anon public key ไปใส่ env

ข้อมูลเริ่มต้น: ใส่แถวผ่านแอปหรือรัน `insert` ใน SQL ตามต้องการ — ไม่มีไฟล์ seed แยกใน repo

## Environment variables

คัดลอก `.env.local.example` เป็น `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

## Google Cloud (API ที่เกี่ยวข้อง)

เปิดใช้อย่างน้อย:

- Maps JavaScript API  
- Directions API  
- Places API (New) — ดึงข้อมูลจาก POI ตอนบันทึกจากหมุด Google  
- Geocoding API — ทางสำรองเมื่อย้อนพิกัดเป็นที่อยู่  

จำกัด key ให้ตรงกับ API ที่เปิด และใส่ referrer สำหรับ `localhost` + โดเมน production

รายละเอียดเวลา Places/Geocoding ล้มเหลว (ขั้นตอนเปิด API / ดู error ใน Console)

# DTC Map Assignment

เว็บแอปแผนที่ตามโจทย์ทดสอบ: แสดงแผนที่, ค้นหาสถานที่, แสดงเส้นทางจากโรงงาน, และเพิ่มสถานที่ใหม่ โดยใช้ Next.js + Supabase + Google Maps

## Features

- แสดงรายการสถานที่จาก Supabase พร้อม marker บนแผนที่
- ค้นหาจากชื่อสถานที่ / ประเภท / ที่อยู่
- คลิกสถานที่เพื่อซูมและเปิดข้อมูล กด「เส้นทาง」เพื่อวาดเส้นจากตำแหน่งผู้ใช้
- เพิ่มสถานที่ใหม่พร้อม validation (ชื่อ + lat/lng)
- รองรับ layout แบบ desktop/mobile

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Supabase (Postgres + RLS)
- Google Maps JavaScript API + Directions API + Places API (New)
- Deploy บน Vercel

## 1) ตั้งค่าฐานข้อมูล Supabase

1. เปิด Supabase SQL Editor
2. รันไฟล์ `supabase/schema.sql` (สร้างตาราง + RLS policies)

> ตารางหลัก: `locations` (`id`, `name_th`, `type`, `address`, `lat`, `lng`, `created_at`) — เพิ่มข้อมูลผ่านแอปหรือ SQL ตามต้องการ

## 2) ตั้งค่า Environment Variables

คัดลอก `.env.local.example` เป็น `.env.local` แล้วกรอกค่าจริง:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_FACTORY_NAME=โรงงาน สตีลชลบุรีกรุ๊ป
NEXT_PUBLIC_FACTORY_LAT=13.67393
NEXT_PUBLIC_FACTORY_LNG=100.61104
```

Google Cloud ต้องเปิด API อย่างน้อย:
- Maps JavaScript API
- Directions API
- **Places API (New)** — ดึงชื่อร้าน/สถานีจากหมุด POI ตอนกด **+** (`Place.fetchFields` ในเบราว์เซอร์)
- **Geocoding API** (แนะนำ) — ถ้า Places ยังไม่เปิดหรือถูกจำกัด แอปจะ**ย้อนพิกัดเป็นที่อยู่**เป็นทางสำรอง

**คลิกหมุด POI บนแผนที่:** การ์ดข้อมูลมาตรฐานของ Google ยังแสดงตามปกติ จากนั้นปุ่ม **+** มุมล่างขวาจะเน้น (วงเรือง) — กดเพื่อบันทึกสถานที่นั้นเป็น marker ของเรา ถ้ายังไม่ได้คลิก POI ปุ่ม **+** จะเปิดฟอร์มเพิ่มสถานที่แบบกรอกมือ

### ถ้าขึ้นข้อความว่าบันทึกพิกัดแล้วแต่ดึงชื่อไม่สำเร็จ

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Enabled APIs**  
2. กด **+ ENABLE APIS AND SERVICES** แล้วค้นหา **Places API (New)** กดเปิดใช้ (ชื่อบางโปรเจกต์อาจขึ้นเป็น *Places API* แบบใหม่)  
3. เปิด **Geocoding API** ด้วยถ้าต้องการทางสำรองย้อนพิกัด  
4. ไปที่ **Credentials** → เลือก API key ที่ใช้ใน `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`  
   - **API restrictions:** เลือก *Restrict key* แล้วติ๊กอย่างน้อย **Maps JavaScript API**, **Directions API**, **Places API (New)**, **Geocoding API**  
   - **Application restrictions:** ถ้าใช้ *HTTP referrers* ให้ใส่ `http://localhost:3000/*` และ `http://127.0.0.1:3000/*` สำหรับ dev และโดเมนจริงตอน deploy  
5. รอสักครู่แล้วรีเฟรชแอป — ในโหมด dev ดู **Console** ของเบราว์เซอร์ จะมี log ข้อความ error จาก Google ช่วยไล่ต่อ

ถ้ายังใช้ API ไม่ได้ แอปจะ**บันทึกเฉพาะพิกัด**พร้อมชื่อชั่วคราวให้แก้ในรายการ

## 3) รันโปรเจกต์ในเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## 4) Deploy บน Vercel

1. Push โค้ดขึ้น Git repository
2. Import โปรเจกต์ใน Vercel
3. ใส่ env เดียวกับ `.env.local`
4. Deploy

## 5) เกณฑ์ตรวจรับก่อนส่งงาน

- แผนที่แสดงได้ และมี marker ครบ
- ค้นหาแล้วรายการกรองถูกต้อง
- คลิก「เส้นทาง」แล้วแสดงเส้นทางจากตำแหน่งผู้ใช้
- เพิ่มสถานที่ใหม่แล้วแสดงทันทีใน list/map
- UI ใช้งานง่ายและ responsive

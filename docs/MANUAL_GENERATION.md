# System Manual Generation

คู่มือการสร้างเอกสารคู่มือระบบ TrendSiam ในรูปแบบ PDF ภาษาไทย

## ภาพรวม

ระบบสร้างคู่มือนี้จะสร้างเอกสาร PDF ภาษาไทยที่ครอบคลุม:
- สถาปัตยกรรมระบบ
- การไหลของข้อมูล
- ความปลอดภัย
- การใช้งาน Supabase
- คู่มือการปฏิบัติการ
- แนวทางการทดสอบ
- บัญชีรายชื่อไฟล์ Python ทั้งหมด
- รายการ API และเส้นทาง

## การติดตั้ง

```bash
cd frontend
npm install
```

## การใช้งาน

### 1. สร้างไดอะแกรม (ไม่บังคับ)

```bash
npm run build:diagrams
```

คำสั่งนี้จะ:
- ตรวจสอบว่ามี Mermaid CLI หรือไม่
- แปลงไฟล์ `.mmd` ใน `docs/diagrams/` เป็น SVG (ถ้ามี CLI)
- บันทึกไฟล์ SVG ใน `frontend/public/diagrams/`
- หากไม่มี CLI จะข้ามขั้นตอนนี้โดยไม่ error

### 2. ทดสอบการสร้างคู่มือ

```bash
npm run test:manual
```

ทดสอบพื้นฐานว่าระบบสร้าง PDF ทำงานได้

### 3. สร้างคู่มือฉบับสมบูรณ์

```bash
npm run build:manual
```

จะสร้างไฟล์ `TrendSiam_คู่มือระบบ_YYYY-MM-DD.pdf` ในโฟลเดอร์ root

## โครงสร้างไฟล์

```
frontend/
├── src/lib/pdf/manual/
│   ├── ManualDoc.tsx           # เอกสารหลัก
│   ├── TitlePage.tsx           # หน้าปก
│   ├── TableOfContents.tsx     # สารบัญ
│   ├── Architecture.tsx        # สถาปัตยกรรม
│   ├── DataFlow.tsx           # การไหลข้อมูล
│   ├── Security.tsx           # ความปลอดภัย
│   ├── Supabase.tsx           # Supabase
│   ├── Operations.tsx         # การปฏิบัติการ
│   ├── Testing.tsx            # การทดสอบ
│   ├── AppendixFiles.tsx      # บัญชีไฟล์
│   ├── AppendixAPIs.tsx       # รายการ API
│   └── fileInventory.ts       # สแกนไฟล์
├── scripts/
│   ├── buildSystemManual.tsx  # สคริปต์สร้างคู่มือ
│   ├── build-diagrams.ts     # สคริปต์สร้างไดอะแกรม
│   └── testManualGeneration.ts # ทดสอบ
└── public/diagrams/           # ไดอะแกรม SVG

docs/diagrams/
├── context.mmd               # ไดอะแกรม Context
├── container.mmd             # ไดอะแกรม Container
├── dataflow.mmd              # ไดอะแกรม Data Flow
└── sequence.mmd              # ไดอะแกรม Sequence
```

## คุณสมบัติ

### การสแกนไฟล์อัตโนมัติ
- สแกนไฟล์ Python ทั้งหมดในโปรเจกต์
- วิเคราะห์ฟังก์ชัน imports และการใช้งาน
- สร้างคำอธิบายภาษาไทยอัตโนมัติ

### การจัดการฟอนต์
- ใช้ฟอนต์ NotoSansThai สำหรับข้อความไทย
- ป้องกันการทับซ้อนของข้อความ
- รองรับ mixed-script (ไทย + อังกฤษ + อีโมจิ)
- แยกระบบฟอนต์สำหรับ server และ CLI เพื่อหลีกเลี่ยง `server-only` error

### ไดอะแกรม
- สร้างจาก Mermaid syntax
- ป้ายกำกับภาษาไทย
- แปลงเป็น SVG สำหรับ PDF

### ความปลอดภัย
- ไม่เปิดเผยข้อมูลลับในเอกสาร
- กรองข้อมูลที่ละเอียดอ่อน
- ใช้เฉพาะข้อมูลสาธารณะ

## การปรับแต่ง

### เพิ่มส่วนใหม่
1. สร้างไฟล์ component ใหม่ใน `src/lib/pdf/manual/`
2. Import และเพิ่มใน `ManualDoc.tsx`
3. อัปเดต `TableOfContents.tsx`

### แก้ไขการแปลภาษาไทย
แก้ไขฟังก์ชัน `translateToThai()` ใน `fileInventory.ts`

### เพิ่มไดอะแกรม
1. สร้างไฟล์ `.mmd` ใน `docs/diagrams/`
2. รัน `npm run build:diagrams`
3. เพิ่มการอ้างอิงใน component ที่เกี่ยวข้อง

## การแก้ไขปัญหา

### ปัญหา: ต้องการไดอะแกรมแต่ไม่มี Mermaid CLI
```bash
# ติดตั้ง Mermaid CLI
npm install -D @mermaid-js/mermaid-cli

# ทดสอบว่าติดตั้งสำเร็จ
npx mmdc --version

# สร้างไดอะแกรม
npm run build:diagrams
```

### ปัญหา: ฟอนต์ไม่แสดงผล
ตรวจสอบว่าไฟล์ฟอนต์อยู่ใน `frontend/public/fonts/`

### ปัญหา: PDF ไฟล์ใหญ่เกินไป
- ลดขนาดไดอะแกรม SVG
- ลดจำนวนไฟล์ในบัญชี

### ปัญหา: ข้อความทับซ้อน
ตรวจสอบการตั้งค่า `lineHeight` และ `letterSpacing` ใน `pdfStyles.ts`

## ข้อจำกัด

- ไม่แก้ไข schema ฐานข้อมูล
- ไม่เปลี่ยน RLS policies
- ไม่แก้ไข environment variables
- ไม่กระทบ UI/UX ของเว็บแอป
- จำกัดเฉพาะการสร้าง PDF และเอกสาร

## การทดสอบ

```bash
# ทดสอบพื้นฐาน
npm run test:manual

# ทดสอบการสร้างไดอะแกรม
npm run build:diagrams

# ทดสอบการสร้างคู่มือ
npm run build:manual

# ตรวจสอบไฟล์ที่สร้าง
ls -la ../../TrendSiam_คู่มือระบบ_*.pdf
```

## การบำรุงรักษา

- อัปเดตคำอธิบายไฟล์เมื่อมีไฟล์ใหม่
- ตรวจสอบความถูกต้องของไดอะแกรม
- อัปเดต API reference เมื่อมี endpoint ใหม่
- ตรวจสอบการแปลภาษาไทย

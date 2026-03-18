const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mysql = require('mysql2/promise');
const cors = require('cors');
const port = 8000;

app.use(bodyParser.json());
app.use(cors());

// ตั้งค่าการเชื่อมต่อฐานข้อมูล (Port 8821 ตามที่ระบุใน Docker)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'beauty_password_2026',  
    database: 'beauty_salon_db',    
    port: 8821             
});

// 1. ดึงรายการบริการ
app.get('/services', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM services');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error: ' + err.message });
    }
});

// 2. จองคิวใหม่ (เพิ่มระบบเช็กเวลาซ้ำ)
app.post('/booking', async (req, res) => {
    const { firstname, lastname, phone, service_id, booking_date, booking_time } = req.body;
    
    // 1. ตรวจสอบค่าว่าง
    if (!firstname || !lastname || !phone || !service_id || !booking_date || !booking_time) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        // --- ส่วนที่เพิ่มใหม่: เช็กเวลาซ้ำ ---
        const [existingBooking] = await db.query(
            'SELECT id FROM bookings WHERE booking_date = ? AND booking_time = ?',
            [booking_date, booking_time]
        );

        if (existingBooking.length > 0) {
            // ถ้าเจอข้อมูลในระบบแล้ว ให้ส่ง Error กลับไปทันที
            return res.status(400).json({ message: 'ขออภัย เวลานี้มีผู้จองแล้ว กรุณาเลือกเวลาอื่น' });
        }
        // --------------------------------

        const fullname = `${firstname} ${lastname}`;
        
        // บันทึกข้อมูล User
        const [userResult] = await db.query(
            'INSERT INTO users (firstname, lastname, fullname, phone) VALUES (?, ?, ?, ?)', 
            [firstname, lastname, fullname, phone]
        );
        const user_id = userResult.insertId;

        // บันทึกการจอง
        await db.query(
            'INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?, ?, ?, ?)',
            [user_id, service_id, booking_date, booking_time]
        );
        
        res.status(200).json({ message: 'จองคิวสำเร็จแล้ว!' }); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

// 3. ดึงนัดหมายรายวัน
app.get('/admin/bookings/:date', async (req, res) => {
    const { date } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT b.id, b.booking_time, u.fullname, s.service_name 
             FROM bookings b 
             JOIN users u ON b.user_id = u.id 
             JOIN services s ON b.service_id = s.id 
             WHERE b.booking_date = ? 
             ORDER BY b.booking_time ASC`, [date]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database Error: ' + err.message });
    }
});

// 4. ยกเลิกการจอง
app.delete('/booking/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM bookings WHERE id = ?', [id]);
        res.json({ message: 'ยกเลิกนัดหมายเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ message: 'Error: ' + err.message });
    }
});

// 5. เลื่อนนัดหมาย (เพิ่มการเช็กเวลาซ้ำก่อนอัปเดต)
app.put('/booking/:id', async (req, res) => {
    const { id } = req.params;
    const { new_date, new_time } = req.body;

    try {
        // 1. เช็กก่อนว่า "เวลาใหม่" ที่จะเลื่อนไป มีคนอื่นจองไว้หรือยัง
        // โดยต้องเช็กด้วยว่า ID ที่จองนั้นไม่ใช่ ID เดิมของตัวเอง (ป้องกันกรณีแก้ไขข้อมูลเดิมแล้วกดซ้ำที่เดิม)
        const [existing] = await db.query(
            'SELECT id FROM bookings WHERE booking_date = ? AND booking_time = ? AND id != ?',
            [new_date, new_time, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'ไม่สามารถเลื่อนนัดได้ เนื่องจากเวลานี้มีผู้จองแล้ว' });
        }

        // 2. ถ้าผ่านการเช็ก ให้ทำการ Update
        await db.query(
            'UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?',
            [new_date, new_time, id] 
        );
        
        res.json({ message: 'เลื่อนนัดหมายสำเร็จ' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
});
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path'); // เพิ่มสำหรับการจัดการ path ไฟล์
const app = express();
const port = 8000;

app.use(bodyParser.json());
app.use(cors());

// --- ส่วนที่แก้ไข: บอกให้ Express รู้จักโฟลเดอร์ Frontend ---
// ชี้ไปที่โฟลเดอร์ Frontend ที่อยู่ระดับเดียวกับโฟลเดอร์ Backend
app.use(express.static(path.join(__dirname, '../Frontend')));

// ตั้งค่าการเชื่อมต่อฐานข้อมูล
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'beauty_password_2026',  
    database: 'beauty_salon_db',    
    port: 8821             
});

// --- ROUTES สำหรับเปิดหน้าเว็บ (เพิ่มใหม่) ---

// หน้าแรก (หน้าจองคิว)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// หน้าตารางการจอง
app.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/schedule.html'));
});


// --- API ENDPOINTS (โค้ดเดิมของคุณที่ปรับให้สมบูรณ์ขึ้น) ---

// 1. ดึงรายการบริการ
app.get('/services', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM services');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error: ' + err.message });
    }
});

// 2. จองคิวใหม่
app.post('/booking', async (req, res) => {
    const { firstname, lastname, phone, service_id, booking_date, booking_time } = req.body;
    
    if (!firstname || !lastname || !phone || !service_id || !booking_date || !booking_time) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        const [existingBooking] = await db.query(
            'SELECT id FROM bookings WHERE booking_date = ? AND booking_time = ?',
            [booking_date, booking_time]
        );

        if (existingBooking.length > 0) {
            return res.status(400).json({ message: 'ขออภัย เวลานี้มีผู้จองแล้ว กรุณาเลือกเวลาอื่น' });
        }

        const fullname = `${firstname} ${lastname}`;
        const [userResult] = await db.query(
            'INSERT INTO users (firstname, lastname, fullname, phone) VALUES (?, ?, ?, ?)', 
            [firstname, lastname, fullname, phone]
        );
        const user_id = userResult.insertId;

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

// 5. เลื่อนนัดหมาย
app.put('/booking/:id', async (req, res) => {
    const { id } = req.params;
    const { new_date, new_time } = req.body;

    try {
        const [existing] = await db.query(
            'SELECT id FROM bookings WHERE booking_date = ? AND booking_time = ? AND id != ?',
            [new_date, new_time, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'เวลานี้มีผู้จองแล้ว ไม่สามารถเลื่อนไปเวลานี้ได้' });
        }

        const [result] = await db.query(
            'UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?',
            [new_date, new_time, id] 
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลนัดหมายที่ต้องการแก้ไข' });
        }

        res.json({ message: 'เลื่อนนัดหมายสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'Error: ' + err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    console.log(`🔗 Booking Page: http://localhost:${port}/`);
    console.log(`🔗 Schedule Page: http://localhost:${port}/schedule`);
});
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

// 2. จองคิวใหม่ (รวมโค้ดตรวจสอบค่าว่าง และแก้ไข Error บันทึกข้อมูล)
app.post('/booking', async (req, res) => {
    const { firstname, lastname, phone, service_id, booking_date, booking_time } = req.body;
    
    // --- ส่วนตรวจสอบค่าว่างตามที่คุณต้องการ ---
    if (!firstname || !lastname || !phone || !service_id || !booking_date || !booking_time) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    try {
        const fullname = `${firstname} ${lastname}`;
        
        // แก้ไข: บันทึกทั้ง firstname และ lastname ลงไปด้วย เพราะใน DB ของคุณตั้งค่าเป็น NOT NULL
        // และเพิ่ม fullname เพื่อให้ระบบค้นหา/แสดงผลง่ายขึ้น
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

// 5. เลื่อนนัดหมาย
app.put('/booking/:id', async (req, res) => {
    const { id } = req.params;
    const { new_date, new_time } = req.body;
    try {
        await db.query(
            'UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?',
            [new_date, new_time, id] 
        );
        res.json({ message: 'เลื่อนนัดหมายสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'Error: ' + err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
});
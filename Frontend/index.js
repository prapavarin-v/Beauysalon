const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mysql = require('mysql2/promise');
const cors = require('cors');
const port = 8000;

app.use(bodyParser.json());
app.use(cors());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'beauty_password_2026',  
    database: 'beauty_salon_db',    
    port: 8821             
});

// API ดึงรายการ service
app.get('/services', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM services');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API บันทึกการจอง (เพิ่ม Validation เช็คค่าว่าง)
app.post('/booking', async (req, res) => {
    const { user_id, service_id, booking_date, booking_time } = req.body;

    // ตรวจสอบว่ามีข้อมูลครบไหม
    if (!service_id || !booking_date || !booking_time) {
        return res.status(400).json({ message: 'กรุณาระบุบริการ วันที่ และเวลาให้ครบถ้วน' });
    }

    try {
        const query = 'INSERT INTO bookings (user_id, service_id, booking_date, booking_time) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(query, [user_id, service_id, booking_date, booking_time]);
        res.status(201).json({ message: 'บันทึกการจองเรียบร้อยแล้ว!', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Database Error: ' + err.message });
    }
});

// ดึงรายการนัดหมายรายวัน
app.get('/admin/bookings/:date', async (req, res) => {
    const { date } = req.params;
    try {
        const sql = `
            SELECT b.*, u.fullname, s.service_name 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            JOIN services s ON b.service_id = s.id 
            WHERE b.booking_date = ?
            ORDER BY b.booking_time ASC
        `;
        const [rows] = await db.query(sql, [date]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ยกเลิกการจอง
app.delete('/booking/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM bookings WHERE id = ?', [id]);
        res.json({ message: 'ยกเลิกนัดหมายเรียบร้อยแล้ว' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
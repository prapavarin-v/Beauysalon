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
// วันนัด
app.get('/admin/bookings/:date', async (req, res) => {
    const { date } = req.params; // รับวันที่จาก URL เช่น /admin/bookings/2026-03-15
    try {
        const [rows] = await db.query(
            'SELECT b.*, u.fullname, s.service_name FROM bookings b ',
            'JOIN users u ON b.user_id = u.id ',
            'JOIN services s ON b.service_id = s.id ',
            'WHERE b.booking_date = ?', [date]
        );
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
// เลื่อนวัน/เวลา นัดหมาย
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
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'badminton_courts.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding voucher_code and discount_amount columns to bookings table...');

db.serialize(() => {
    db.run(`ALTER TABLE bookings ADD COLUMN voucher_code TEXT`);
    db.run(`ALTER TABLE bookings ADD COLUMN discount_amount REAL DEFAULT 0`);
    console.log('✅ Columns added successfully!');
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('✅ Migration completed!');
    }
}); 
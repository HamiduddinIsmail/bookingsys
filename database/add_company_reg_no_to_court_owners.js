const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'badminton_courts.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding company_reg_no column to court_owners table...');

db.serialize(() => {
    db.run(`ALTER TABLE court_owners ADD COLUMN company_reg_no TEXT`);
    console.log('✅ Column added successfully!');
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('✅ Migration completed!');
    }
}); 
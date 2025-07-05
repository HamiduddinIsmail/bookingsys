const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'badminton_courts.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding business_email column to court_owners table...');

db.serialize(() => {
    db.run(`ALTER TABLE court_owners ADD COLUMN business_email TEXT`);
    console.log('✅ Column added successfully!');
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('✅ Migration completed!');
    }
}); 
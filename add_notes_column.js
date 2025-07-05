const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/badminton_courts.db');

db.serialize(() => {
  db.all("PRAGMA table_info(bookings);", (err, columns) => {
    if (err) {
      console.error('Error reading table info:', err.message);
      db.close();
      return;
    }
    const hasNotes = columns.some(col => col.name === 'notes');
    if (hasNotes) {
      console.log('✅ notes column already exists.');
      db.close();
      return;
    }
    db.run("ALTER TABLE bookings ADD COLUMN notes VARCHAR(255);", err => {
      if (err) {
        console.error('Error adding notes column:', err.message);
      } else {
        console.log('✅ notes column added successfully!');
      }
      db.close();
    });
  });
}); 
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/badminton_courts.db');

const userId = 2; // Change this if your owner user has a different ID
const businessName = "Demo Owner's Courts";

db.run(
  "INSERT INTO court_owners (user_id, business_name) VALUES (?, ?)",
  [userId, businessName],
  function (err) {
    if (err) {
      console.error('Error:', err.message);
    } else {
      console.log('Court owner profile created for user ID', userId);
    }
    db.close();
  }
); 
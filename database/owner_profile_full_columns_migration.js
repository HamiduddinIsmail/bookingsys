const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'badminton_courts.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Adding all required columns for owner profile to court_owners table...');

const columns = [
  { name: 'business_name', type: 'TEXT' },
  { name: 'company_reg_no', type: 'TEXT' },
  { name: 'registered_address', type: 'TEXT' },
  { name: 'business_phone', type: 'TEXT' },
  { name: 'business_email', type: 'TEXT' },
  { name: 'logo_path', type: 'TEXT' },
  { name: 'bank_name', type: 'TEXT' },
  { name: 'bank_account_number', type: 'TEXT' },
  { name: 'account_holder_name', type: 'TEXT' },
  { name: 'supporting_document', type: 'TEXT' },
  { name: 'bank_verification_status', type: 'TEXT' },
  { name: 'subscription_plan', type: 'TEXT' },
  { name: 'plan_duration', type: 'TEXT' },
  { name: 'auto_renew', type: 'INTEGER' },
  { name: 'payment_gateway', type: 'TEXT' },
  { name: 'subscription_status', type: 'TEXT' },
  { name: 'profile_complete', type: 'INTEGER DEFAULT 0' }
];

db.serialize(() => {
  db.all("PRAGMA table_info(court_owners)", (err, rows) => {
    if (err) throw err;
    const existing = rows.map(r => r.name);
    columns.forEach(col => {
      if (!existing.includes(col.name)) {
        db.run(`ALTER TABLE court_owners ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
      }
    });
    console.log('✅ All required columns checked/added!');
  });
});

db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err.message);
  } else {
    console.log('✅ Migration completed!');
  }
}); 
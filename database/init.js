const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Create database directory if it doesn't exist
const dbPath = path.join(__dirname, 'badminton_courts.db');
const db = new sqlite3.Database(dbPath);

console.log('🏗️  Initializing database...');

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Court owners table
    db.run(`CREATE TABLE IF NOT EXISTS court_owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        business_name TEXT NOT NULL,
        business_address TEXT,
        business_phone TEXT,
        bank_details TEXT,
        payout_info TEXT,
        is_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Courts table
    db.run(`CREATE TABLE IF NOT EXISTS courts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        court_type TEXT DEFAULT 'synthetic',
        indoor_outdoor TEXT DEFAULT 'indoor',
        has_ac BOOLEAN DEFAULT 0,
        has_food BOOLEAN DEFAULT 0,
        has_rest_area BOOLEAN DEFAULT 0,
        has_changing_room BOOLEAN DEFAULT 0,
        has_parking BOOLEAN DEFAULT 0,
        hourly_rate REAL NOT NULL,
        open_time TEXT DEFAULT '06:00',
        close_time TEXT DEFAULT '22:00',
        is_active BOOLEAN DEFAULT 1,
        is_approved BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES court_owners (id)
    )`);

    // Court images table
    db.run(`CREATE TABLE IF NOT EXISTS court_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court_id INTEGER,
        image_path TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (court_id) REFERENCES courts (id)
    )`);

    // Bookings table
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court_id INTEGER,
        user_id INTEGER,
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        total_hours INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        notes VARCHAR(255),
        payment_status TEXT DEFAULT 'pending',
        booking_status TEXT DEFAULT 'confirmed',
        payment_intent_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (court_id) REFERENCES courts (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Reviews table
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court_id INTEGER,
        user_id INTEGER,
        booking_id INTEGER,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (court_id) REFERENCES courts (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
    )`);

    // Court availability table
    db.run(`CREATE TABLE IF NOT EXISTS court_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court_id INTEGER,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_blocked BOOLEAN DEFAULT 0,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (court_id) REFERENCES courts (id)
    )`);

    // Payments table
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER,
        amount REAL NOT NULL,
        payment_method TEXT,
        transaction_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
    )`);

    // Payouts table
    db.run(`CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payout_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES court_owners (id)
    )`);

    // Promotions/Vouchers table
    db.run(`CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
        discount_value REAL NOT NULL,
        min_booking_amount REAL DEFAULT 0,
        max_discount_amount REAL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        usage_limit INTEGER DEFAULT -1,
        used_count INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL,
        target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'specific')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // Promotion targets table (for specific users)
    db.run(`CREATE TABLE IF NOT EXISTS promotion_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (promotion_id) REFERENCES promotions (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Voucher usage tracking
    db.run(`CREATE TABLE IF NOT EXISTS voucher_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_id INTEGER,
        booking_id INTEGER,
        user_id INTEGER,
        discount_amount REAL NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (promotion_id) REFERENCES promotions (id),
        FOREIGN KEY (booking_id) REFERENCES bookings (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Create indexes for better performance
    db.run('CREATE INDEX IF NOT EXISTS idx_courts_location ON courts(latitude, longitude)');
    db.run('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_bookings_court ON bookings(court_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_reviews_court ON reviews(court_id)');

    console.log('✅ Database tables created successfully!');

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password, role, first_name, last_name) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['admin', 'admin@badmintoncourts.com', adminPassword, 'admin', 'Platform', 'Admin']);

    // Insert sample court owner
    const ownerPassword = bcrypt.hashSync('owner123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password, role, first_name, last_name) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['owner1', 'owner1@example.com', ownerPassword, 'owner', 'John', 'CourtOwner']);

    // Insert sample end user
    const userPassword = bcrypt.hashSync('user123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, email, password, role, first_name, last_name) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['user1', 'user1@example.com', userPassword, 'user', 'Jane', 'Player']);

    console.log('✅ Default users created!');
    console.log('📋 Default login credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Owner: owner1 / owner123');
    console.log('   User: user1 / user123');
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err.message);
    } else {
        console.log('✅ Database initialization completed!');
    }
}); 
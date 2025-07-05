const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/badminton_courts.db');

const ownerUserId = 2; // Default owner1 user

// Get the court owner id for user_id 2
const getOwnerId = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM court_owners WHERE user_id = ?', [ownerUserId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('No court owner found for user_id 2'));
      resolve(row.id);
    });
  });
};

const courts = [
  {
    name: 'Smash Arena',
    description: 'Premium indoor badminton court with AC and refreshments.',
    address: '123 Main Street, City Center',
    latitude: 0,
    longitude: 0,
    court_type: 'synthetic',
    indoor_outdoor: 'indoor',
    has_ac: 1,
    has_food: 1,
    has_rest_area: 1,
    has_changing_room: 1,
    has_parking: 1,
    hourly_rate: 20,
    open_time: '07:00',
    close_time: '22:00',
    is_active: 1,
    is_approved: 1
  },
  {
    name: 'Green Court',
    description: 'Outdoor cement court with parking and rest area.',
    address: '456 Park Avenue, Suburbia',
    latitude: 0,
    longitude: 0,
    court_type: 'cement',
    indoor_outdoor: 'outdoor',
    has_ac: 0,
    has_food: 0,
    has_rest_area: 1,
    has_changing_room: 0,
    has_parking: 1,
    hourly_rate: 12,
    open_time: '06:00',
    close_time: '20:00',
    is_active: 1,
    is_approved: 1
  },
  {
    name: 'Family Sports Hall',
    description: 'Friendly indoor court, fan only, changing room available.',
    address: '789 Family Rd, Uptown',
    latitude: 0,
    longitude: 0,
    court_type: 'synthetic',
    indoor_outdoor: 'indoor',
    has_ac: 0,
    has_food: 0,
    has_rest_area: 1,
    has_changing_room: 1,
    has_parking: 0,
    hourly_rate: 15,
    open_time: '08:00',
    close_time: '21:00',
    is_active: 1,
    is_approved: 1
  }
];

(async () => {
  try {
    const ownerId = await getOwnerId();
    const stmt = db.prepare(`INSERT INTO courts (
      owner_id, name, description, address, latitude, longitude, court_type, indoor_outdoor, has_ac, has_food, has_rest_area, has_changing_room, has_parking, hourly_rate, open_time, close_time, is_active, is_approved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const court of courts) {
      stmt.run([
        ownerId,
        court.name,
        court.description,
        court.address,
        court.latitude,
        court.longitude,
        court.court_type,
        court.indoor_outdoor,
        court.has_ac,
        court.has_food,
        court.has_rest_area,
        court.has_changing_room,
        court.has_parking,
        court.hourly_rate,
        court.open_time,
        court.close_time,
        court.is_active,
        court.is_approved
      ]);
    }
    stmt.finalize();
    console.log('Dummy courts added!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    db.close();
  }
})(); 
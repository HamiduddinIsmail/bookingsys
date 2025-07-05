const express = require('express');
const { runQuery, getRow, run } = require('../database/db');
const router = express.Router();

// Get all courts (search and filter)
router.get('/', async (req, res) => {
    try {
        const { location, date, time, court_type, indoor_outdoor, has_ac, has_parking, has_food } = req.query;
        
        let sql = `
            SELECT c.*, co.business_name, co.business_address,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating,
                   (SELECT COUNT(*) FROM reviews WHERE court_id = c.id) as review_count,
                   (SELECT image_path FROM court_images WHERE court_id = c.id AND is_primary = 1 LIMIT 1) as primary_image
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.is_active = 1 AND c.is_approved = 1
        `;
        
        const params = [];
        
        // Add filters
        if (location) {
            sql += ` AND (c.address LIKE ? OR co.business_address LIKE ?)`;
            params.push(`%${location}%`, `%${location}%`);
        }
        
        if (court_type) {
            sql += ` AND c.court_type = ?`;
            params.push(court_type);
        }
        
        if (indoor_outdoor) {
            sql += ` AND c.indoor_outdoor = ?`;
            params.push(indoor_outdoor);
        }
        
        if (has_ac === 'true') {
            sql += ` AND c.has_ac = 1`;
        }
        
        if (has_parking === 'true') {
            sql += ` AND c.has_parking = 1`;
        }
        
        if (has_food === 'true') {
            sql += ` AND c.has_food = 1`;
        }
        
        sql += ` ORDER BY c.created_at DESC`;
        
        const courts = await runQuery(sql, params);
        
        // Get all images for each court
        for (let court of courts) {
            const images = await runQuery(
                'SELECT * FROM court_images WHERE court_id = ? ORDER BY is_primary DESC',
                [court.id]
            );
            court.images = images;
        }
        
        res.render('courts/index', {
            title: 'Search Courts',
            user: req.session.user,
            courts,
            filters: req.query
        });
    } catch (error) {
        console.error('Courts search error:', error);
        res.render('error', {
            error: 'Error searching courts',
            user: req.session.user,
            title: 'Error'
        });
    }
});

// Get single court details
router.get('/:id', async (req, res) => {
    try {
        const courtId = req.params.id;
        
        // Get court details
        const court = await getRow(`
            SELECT c.*, co.business_name, co.business_address, co.business_phone,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating,
                   (SELECT COUNT(*) FROM reviews WHERE court_id = c.id) as review_count
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.id = ? AND c.is_active = 1
        `, [courtId]);
        
        if (!court) {
            return res.render('error', {
                error: 'Court not found',
                user: req.session.user,
                title: 'Error'
            });
        }
        
        // Get court images
        const images = await runQuery(
            'SELECT * FROM court_images WHERE court_id = ? ORDER BY is_primary DESC',
            [courtId]
        );
        
        // Get reviews
        const reviews = await runQuery(`
            SELECT r.*, u.first_name, u.last_name, u.username
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.court_id = ?
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [courtId]);
        
        // Get available time slots for today
        const today = new Date().toISOString().split('T')[0];
        const availableSlots = await getAvailableTimeSlots(courtId, today);
        
        res.render('courts/detail', {
            title: court.name,
            user: req.session.user,
            court,
            images,
            reviews,
            availableSlots,
            selectedDate: today
        });
    } catch (error) {
        console.error('Court detail error:', error);
        res.render('error', {
            error: 'Error loading court details',
            user: req.session.user,
            title: 'Error'
        });
    }
});

// Helper function to get available time slots
async function getAvailableTimeSlots(courtId, date) {
    try {
        const court = await getRow('SELECT open_time, close_time FROM courts WHERE id = ?', [courtId]);
        if (!court) return [];
        
        // Get existing bookings for the date
        const bookings = await runQuery(`
            SELECT start_time, end_time FROM bookings 
            WHERE court_id = ? AND booking_date = ? AND booking_status = 'confirmed'
        `, [courtId, date]);
        
        // Generate time slots
        const slots = [];
        const openHour = parseInt(court.open_time.split(':')[0]);
        const closeHour = parseInt(court.close_time.split(':')[0]);
        
        for (let hour = openHour; hour < closeHour; hour++) {
            const startTime = `${hour.toString().padStart(2, '0')}:00`;
            const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
            
            // Check if slot is available
            const isBooked = bookings.some(booking => 
                booking.start_time <= startTime && booking.end_time > startTime
            );
            
            if (!isBooked) {
                slots.push({
                    start_time: startTime,
                    end_time: endTime,
                    available: true
                });
            }
        }
        
        return slots;
    } catch (error) {
        console.error('Error getting time slots:', error);
        return [];
    }
}

// Get available time slots for a specific date (AJAX)
router.get('/:id/slots', async (req, res) => {
    try {
        const { date } = req.query;
        const courtId = req.params.id;
        
        const slots = await getAvailableTimeSlots(courtId, date);
        res.json(slots);
    } catch (error) {
        console.error('Time slots error:', error);
        res.status(500).json({ error: 'Error getting time slots' });
    }
});

// Booking page for a court (requires login)
router.get('/:id/book', async (req, res) => {
    if (!req.session.user) {
        return res.redirect(`/auth/login?redirect=/courts/${req.params.id}/book`);
    }
    try {
        const courtId = req.params.id;
        // Get court details
        const court = await getRow(`
            SELECT c.*, co.business_name, co.business_address, co.business_phone,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating,
                   (SELECT COUNT(*) FROM reviews WHERE court_id = c.id) as review_count
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.id = ? AND c.is_active = 1
        `, [courtId]);
        if (!court) {
            return res.render('error', {
                error: 'Court not found',
                user: req.session.user,
                title: 'Error'
            });
        }
        
        // Get court images
        const images = await runQuery(
            'SELECT * FROM court_images WHERE court_id = ? ORDER BY is_primary DESC',
            [courtId]
        );
        court.images = images;
        
        // Get available time slots for today
        const today = new Date().toISOString().split('T')[0];
        const availableSlots = await getAvailableTimeSlots(courtId, today);
        res.render('courts/book', {
            title: `Book ${court.name}`,
            user: req.session.user,
            court,
            availableSlots,
            selectedDate: today
        });
    } catch (error) {
        console.error('Booking page error:', error);
        res.render('error', {
            error: 'Error loading booking page',
            user: req.session.user,
            title: 'Error'
        });
    }
});

module.exports = router; 
const express = require('express');
const { runQuery, getRow, run } = require('../database/db');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

// Create a new booking
router.post('/', requireAuth, async (req, res) => {
    console.log('Booking POST body:', req.body); // Debug: log incoming form data
    try {
        const { court_id, booking_date, start_time, end_time, total_hours, notes, voucher_code, discount_amount } = req.body;
        const userId = req.session.user.id;
        
        // Validate booking
        if (!court_id || !booking_date || !start_time || !end_time || !total_hours) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check if court exists and is available
        const court = await getRow(
            'SELECT * FROM courts WHERE id = ? AND is_active = 1 AND is_approved = 1',
            [court_id]
        );
        
        if (!court) {
            return res.status(404).json({ error: 'Court not found or not available' });
        }
        
        // Check if time slot is available
        const existingBooking = await getRow(`
            SELECT id FROM bookings 
            WHERE court_id = ? AND booking_date = ? 
            AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
            AND booking_status = 'confirmed'
        `, [court_id, booking_date, start_time, start_time, end_time, end_time]);
        
        if (existingBooking) {
            return res.status(400).json({ error: 'Time slot is already booked' });
        }
        
        // Calculate total amount
        let totalAmount = court.hourly_rate * total_hours;
        let finalAmount = totalAmount;
        
        // Apply voucher discount if provided
        if (voucher_code && discount_amount) {
            finalAmount = totalAmount - parseFloat(discount_amount);
            
            // Record voucher usage
            await run(`
                INSERT INTO voucher_usage (promotion_id, user_id, booking_id, discount_amount, used_at)
                VALUES (?, ?, ?, ?, ?)
            `, [voucher_code, userId, null, discount_amount, new Date()]);
        }
        
        // Create booking
        const result = await run(`
            INSERT INTO bookings (court_id, user_id, booking_date, start_time, end_time, total_hours, total_amount, notes, voucher_code, discount_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [court_id, userId, booking_date, start_time, end_time, total_hours, finalAmount, notes ? notes.substring(0, 255) : null, voucher_code || null, discount_amount || 0]);
        
        // Update voucher usage with booking ID
        if (voucher_code && discount_amount) {
            await run(`
                UPDATE voucher_usage 
                SET booking_id = ? 
                WHERE promotion_id = ? AND user_id = ? AND booking_id IS NULL
            `, [result.id, voucher_code, userId]);
            // Increment used_count in promotions table
            await run(`
                UPDATE promotions SET used_count = used_count + 1 WHERE code = ?
            `, [voucher_code]);
        }
        
        res.json({
            success: true,
            booking_id: result.id,
            total_amount: finalAmount,
            original_amount: totalAmount,
            discount_amount: discount_amount || 0
        });
    } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({ error: 'Error creating booking' });
    }
});

// Get user's bookings
router.get('/my-bookings', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const bookings = await runQuery(`
            SELECT b.*, c.name as court_name, c.address as court_address,
                   co.business_name, co.business_phone
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN court_owners co ON c.owner_id = co.id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC, b.start_time DESC
        `, [userId]);
        
        res.render('bookings/my-bookings', {
            title: 'My Bookings',
            user: req.session.user,
            bookings
        });
    } catch (error) {
        console.error('My bookings error:', error);
        res.render('error', {
            error: 'Error loading bookings',
            user: req.session.user
        });
    }
});

// Get booking details
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        
        const booking = await getRow(`
            SELECT b.*, c.name as court_name, c.address as court_address,
                   co.business_name, co.business_phone, u.first_name, u.last_name
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN court_owners co ON c.owner_id = co.id
            JOIN users u ON b.user_id = u.id
            WHERE b.id = ? AND b.user_id = ?
        `, [bookingId, userId]);
        
        if (!booking) {
            return res.render('error', {
                error: 'Booking not found',
                user: req.session.user
            });
        }
        
        res.render('bookings/detail', {
            title: 'Booking Details',
            user: req.session.user,
            booking
        });
    } catch (error) {
        console.error('Booking detail error:', error);
        res.render('error', {
            error: 'Error loading booking details',
            user: req.session.user
        });
    }
});

// Cancel booking
router.post('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        
        // Check if booking exists and belongs to user
        const booking = await getRow(
            'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
            [bookingId, userId]
        );
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Check if booking can be cancelled (not too close to booking time)
        const bookingDateTime = new Date(`${booking.booking_date} ${booking.start_time}`);
        const now = new Date();
        const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
        
        if (hoursUntilBooking < 2) {
            return res.status(400).json({ error: 'Cannot cancel booking within 2 hours of start time' });
        }
        
        // Update booking status
        await run(
            'UPDATE bookings SET booking_status = ? WHERE id = ?',
            ['cancelled', bookingId]
        );
        
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Error cancelling booking' });
    }
});

// Submit review for booking
router.post('/:id/review', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        const { rating, comment } = req.body;
        
        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Invalid rating' });
        }
        
        // Check if booking exists and belongs to user
        const booking = await getRow(
            'SELECT * FROM bookings WHERE id = ? AND user_id = ? AND booking_status = ?',
            [bookingId, userId, 'completed']
        );
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found or not completed' });
        }
        
        // Check if review already exists
        const existingReview = await getRow(
            'SELECT id FROM reviews WHERE booking_id = ?',
            [bookingId]
        );
        
        if (existingReview) {
            return res.status(400).json({ error: 'Review already submitted for this booking' });
        }
        
        // Create review
        await run(`
            INSERT INTO reviews (court_id, user_id, booking_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `, [booking.court_id, userId, bookingId, rating, comment]);
        
        res.json({ success: true, message: 'Review submitted successfully' });
    } catch (error) {
        console.error('Review submission error:', error);
        res.status(500).json({ error: 'Error submitting review' });
    }
});

// Payment confirmation (simplified - in real app, integrate with Stripe)
router.post('/:id/pay', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;
        
        // Check if booking exists and belongs to user
        const booking = await getRow(
            'SELECT * FROM bookings WHERE id = ? AND user_id = ? AND payment_status = ?',
            [bookingId, userId, 'pending']
        );
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found or already paid' });
        }
        
        // Update payment status (simplified - in real app, verify payment with Stripe)
        await run(
            'UPDATE bookings SET payment_status = ? WHERE id = ?',
            ['paid', bookingId]
        );
        
        // Create payment record
        await run(`
            INSERT INTO payments (booking_id, amount, payment_method, status)
            VALUES (?, ?, ?, ?)
        `, [bookingId, booking.total_amount, 'online', 'completed']);
        
        res.json({ success: true, message: 'Payment successful' });
    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ error: 'Error processing payment' });
    }
});

module.exports = router; 
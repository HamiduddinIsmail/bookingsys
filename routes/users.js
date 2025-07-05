const express = require('express');
const { runQuery, getRow, run } = require('../database/db');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

// Middleware to check if user is court owner
const requireOwner = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'owner') {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access Denied',
            error: 'Access denied. Court owner privileges required.',
            user: req.session.user
        });
    }
};

// Multer storage config for court images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/courts'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ storage, fileFilter: imageFilter });

// Middleware: Require owner to complete profile (parts 1-3)
async function requireOwnerProfileComplete(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'owner') return res.redirect('/auth/login');
    const owner = await getRow('SELECT * FROM court_owners WHERE user_id = ?', [req.session.user.id]);
    if (!owner || !owner.business_name || !owner.business_phone || !owner.business_email || !owner.bank_name || !owner.bank_account_number || !owner.account_holder_name || !owner.subscription_plan || !owner.subscription_status) {
        return res.redirect('/users/profile');
    }
    next();
}

// Court owner dashboard
router.get('/dashboard', requireOwner, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get court owner info
        const owner = await getRow(
            'SELECT * FROM court_owners WHERE user_id = ?',
            [userId]
        );
        
        if (!owner) {
            return res.render('users/setup-owner', {
                title: 'Setup Court Owner Profile',
                user: req.session.user,
                message: 'You need to set up your court owner profile before managing courts. Please complete your profile.'
            });
        }
        
        // Get owner's courts
        const courts = await runQuery(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM bookings WHERE court_id = c.id AND booking_status = 'confirmed') as total_bookings,
                   (SELECT SUM(total_amount) FROM bookings WHERE court_id = c.id AND payment_status = 'paid') as total_revenue,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating
            FROM courts c
            WHERE c.owner_id = ?
            ORDER BY c.created_at DESC
        `, [owner.id]);
        
        // Get recent bookings
        const recentBookings = await runQuery(`
            SELECT b.*, c.name as court_name, u.first_name, u.last_name, u.email
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN users u ON b.user_id = u.id
            WHERE c.owner_id = ?
            ORDER BY b.created_at DESC
            LIMIT 10
        `, [owner.id]);
        
        // Get earnings summary
        const earnings = await getRow(`
            SELECT 
                SUM(b.total_amount * 0.8) as total_earnings,
                SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_amount * 0.8 ELSE 0 END) as paid_earnings,
                SUM(CASE WHEN b.payment_status = 'pending' THEN b.total_amount * 0.8 ELSE 0 END) as pending_earnings
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ?
        `, [owner.id]);
        
        res.render('users/dashboard', {
            title: 'Court Owner Dashboard',
            user: req.session.user,
            owner,
            courts,
            recentBookings,
            earnings
        });
    } catch (error) {
        console.error('Owner dashboard error:', error);
        res.render('error', {
            title: 'Error',
            error: 'Error loading dashboard',
            user: req.session.user
        });
    }
});

// Manage courts (for court owners)
router.get('/courts', requireOwner, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const owner = await getRow(
            'SELECT * FROM court_owners WHERE user_id = ?',
            [userId]
        );
        if (!owner) {
            return res.render('users/setup-owner', {
                title: 'Setup Court Owner Profile',
                user: req.session.user,
                message: 'You need to set up your court owner profile before managing courts. Please complete your profile.'
            });
        }
        // Build filters from query
        const filters = {
            location: req.query.location || '',
            court_type: req.query.court_type || '',
            indoor_outdoor: req.query.indoor_outdoor || '',
            has_ac: req.query.has_ac || '',
            has_parking: req.query.has_parking || '',
            has_food: req.query.has_food || ''
        };
        // Build SQL and params
        let sql = `SELECT c.*, 
                   (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) as booking_count,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating
            FROM courts c
            WHERE c.owner_id = ?`;
        const params = [owner.id];
        if (filters.location) {
            sql += ' AND (c.address LIKE ? OR c.name LIKE ?)';
            params.push(`%${filters.location}%`, `%${filters.location}%`);
        }
        if (filters.court_type) {
            sql += ' AND c.court_type = ?';
            params.push(filters.court_type);
        }
        if (filters.indoor_outdoor) {
            sql += ' AND c.indoor_outdoor = ?';
            params.push(filters.indoor_outdoor);
        }
        if (filters.has_ac === 'true') {
            sql += ' AND c.has_ac = 1';
        }
        if (filters.has_parking === 'true') {
            sql += ' AND c.has_parking = 1';
        }
        if (filters.has_food === 'true') {
            sql += ' AND c.has_food = 1';
        }
        sql += ' ORDER BY c.created_at DESC';
        const courts = await runQuery(sql, params);
        // Fetch images for each court
        for (const court of courts) {
            court.images = await runQuery('SELECT * FROM court_images WHERE court_id = ? ORDER BY is_primary DESC, id ASC', [court.id]);
        }
        res.render('users/courts', {
            title: 'My Courts',
            user: req.session.user,
            courts,
            filters
        });
    } catch (error) {
        console.error('Courts management error:', error);
        res.render('error', {
            title: 'Error',
            error: 'Error loading courts',
            user: req.session.user
        });
    }
});

// Add new court
router.get('/courts/add', requireOwner, (req, res) => {
    res.render('users/add-court', {
        title: 'Add New Court',
        user: req.session.user
    });
});

router.post('/courts/add', requireOwner, upload.array('court_images', 10), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const owner = await getRow(
            'SELECT * FROM court_owners WHERE user_id = ?',
            [userId]
        );
        const {
            name, description, address, latitude, longitude,
            court_type, indoor_outdoor, has_ac, has_food,
            has_rest_area, has_changing_room, has_parking,
            hourly_rate, open_time, close_time
        } = req.body;
        if (!name || !address || !hourly_rate) {
            return res.render('users/add-court', {
                title: 'Add New Court',
                user: req.session.user,
                error: 'Please fill in all required fields'
            });
        }
        // Insert court
        const result = await run(`
            INSERT INTO courts (
                owner_id, name, description, address, latitude, longitude,
                court_type, indoor_outdoor, has_ac, has_food, has_rest_area,
                has_changing_room, has_parking, hourly_rate, open_time, close_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            owner.id, name, description, address, latitude || null, longitude || null,
            court_type || 'synthetic', indoor_outdoor || 'indoor',
            has_ac ? 1 : 0, has_food ? 1 : 0, has_rest_area ? 1 : 0,
            has_changing_room ? 1 : 0, has_parking ? 1 : 0,
            hourly_rate, open_time || '06:00', close_time || '22:00'
        ]);
        // Save images
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await run(
                    'INSERT INTO court_images (court_id, image_path, is_primary) VALUES (?, ?, ?)',
                    [result.id, file.filename, 0]
                );
            }
        }
        res.redirect('/users/courts?success=Court added successfully! Pending admin approval.');
    } catch (error) {
        console.error('Add court error:', error);
        res.render('users/add-court', {
            title: 'Add New Court',
            user: req.session.user,
            error: 'Error adding court'
        });
    }
});

// Delete court - more specific route to avoid conflicts
router.delete('/courts/:id', requireOwner, async (req, res) => {
    try {
        const courtId = req.params.id;
        const userId = req.session.user.id;
        
        // Verify ownership
        const court = await getRow(`
            SELECT c.* FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.id = ? AND co.user_id = ?
        `, [courtId, userId]);
        
        if (!court) {
            return res.status(404).json({ 
                success: false, 
                error: 'Court not found or you do not have permission to delete it' 
            });
        }
        
        // Check if court has any bookings
        const existingBookings = await getRow(
            'SELECT COUNT(*) as count FROM bookings WHERE court_id = ?',
            [courtId]
        );
        
        if (existingBookings.count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete court with existing bookings. Please contact support.' 
            });
        }
        
        // Delete court images from filesystem
        const courtImages = await runQuery(
            'SELECT image_path FROM court_images WHERE court_id = ?',
            [courtId]
        );
        
        const fs = require('fs');
        for (const image of courtImages) {
            const imgPath = path.join(__dirname, '../public/uploads/courts', image.image_path);
            if (fs.existsSync(imgPath)) {
                fs.unlinkSync(imgPath);
            }
        }
        
        // Delete from database (cascade will handle related records)
        await run('DELETE FROM court_images WHERE court_id = ?', [courtId]);
        await run('DELETE FROM courts WHERE id = ?', [courtId]);
        
        res.json({ 
            success: true, 
            message: 'Court deleted successfully' 
        });
        
    } catch (error) {
        console.error('Delete court error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'An error occurred while deleting the court' 
        });
    }
});

// Edit court
router.get('/courts/:id/edit', requireOwner, async (req, res) => {
    try {
        const courtId = req.params.id;
        const userId = req.session.user.id;
        // Get court and verify ownership
        const court = await getRow(`
            SELECT c.* FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.id = ? AND co.user_id = ?
        `, [courtId, userId]);
        if (!court) {
            return res.render('error', {
                title: 'Error',
                error: 'Court not found',
                user: req.session.user
            });
        }
        // Fetch images for this court
        court.images = await runQuery('SELECT * FROM court_images WHERE court_id = ? ORDER BY is_primary DESC, id ASC', [courtId]);
        res.render('users/edit-court', {
            title: 'Edit Court',
            user: req.session.user,
            court
        });
    } catch (error) {
        console.error('Edit court error:', error);
        res.render('error', {
            title: 'Error',
            error: 'Error loading court',
            user: req.session.user
        });
    }
});

router.post('/courts/:id/edit', requireOwner, upload.array('court_images', 10), async (req, res) => {
    try {
        const courtId = req.params.id;
        const userId = req.session.user.id;
        // Verify ownership
        const court = await getRow(`
            SELECT c.* FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            WHERE c.id = ? AND co.user_id = ?
        `, [courtId, userId]);
        if (!court) {
            return res.status(404).json({ error: 'Court not found' });
        }
        const {
            name, description, address, latitude, longitude,
            court_type, indoor_outdoor, has_ac, has_food,
            has_rest_area, has_changing_room, has_parking,
            hourly_rate, open_time, close_time
        } = req.body;
        // Update court
        await run(`
            UPDATE courts SET 
                name = ?, description = ?, address = ?, latitude = ?, longitude = ?,
                court_type = ?, indoor_outdoor = ?, has_ac = ?, has_food = ?,
                has_rest_area = ?, has_changing_room = ?, has_parking = ?,
                hourly_rate = ?, open_time = ?, close_time = ?
            WHERE id = ?
        `, [
            name, description, address, latitude || null, longitude || null,
            court_type || 'synthetic', indoor_outdoor || 'indoor',
            has_ac ? 1 : 0, has_food ? 1 : 0, has_rest_area ? 1 : 0,
            has_changing_room ? 1 : 0, has_parking ? 1 : 0,
            hourly_rate, open_time || '06:00', close_time || '22:00', courtId
        ]);
        // Remove images if requested
        let removeImages = req.body.remove_images;
        if (removeImages) {
            if (!Array.isArray(removeImages)) removeImages = [removeImages];
            for (const imgId of removeImages) {
                const img = await getRow('SELECT * FROM court_images WHERE id = ? AND court_id = ?', [imgId, courtId]);
                if (img) {
                    // Delete file
                    const fs = require('fs');
                    const imgPath = path.join(__dirname, '../public/uploads/courts', img.image_path);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                    // Delete DB record
                    await run('DELETE FROM court_images WHERE id = ?', [imgId]);
                }
            }
        }
        // Save new images
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await run(
                    'INSERT INTO court_images (court_id, image_path, is_primary) VALUES (?, ?, ?)',
                    [courtId, file.filename, 0]
                );
            }
        }
        res.redirect('/users/courts?success=Court updated successfully!');
    } catch (error) {
        console.error('Update court error:', error);
        res.render('users/edit-court', {
            title: 'Edit Court',
            user: req.session.user,
            court: req.body,
            error: 'Error updating court'
        });
    }
});

// Manage bookings (for court owners)
router.get('/bookings', requireOwner, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const owner = await getRow(
            'SELECT * FROM court_owners WHERE user_id = ?',
            [userId]
        );
        
        const bookings = await runQuery(`
            SELECT b.*, c.name as court_name, u.first_name, u.last_name, u.email, u.phone
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN users u ON b.user_id = u.id
            WHERE c.owner_id = ?
            ORDER BY b.booking_date DESC, b.start_time DESC
        `, [owner.id]);
        
        res.render('users/bookings', {
            title: 'Manage Bookings',
            user: req.session.user,
            bookings
        });
    } catch (error) {
        console.error('Bookings management error:', error);
        res.render('error', {
            title: 'Error',
            error: 'Error loading bookings',
            user: req.session.user
        });
    }
});

// Sales Dashboard
router.get('/earnings', requireOwner, async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log('User ID:', userId);
        
        const owner = await getRow(
            'SELECT * FROM court_owners WHERE user_id = ?',
            [userId]
        );
        
        if (!owner) {
            console.log('No owner found for user:', userId);
            return res.render('error', {
                title: 'Error',
                error: 'Owner profile not found. Please complete your owner profile setup.',
                user: req.session.user
            });
        }
        
        console.log('Owner found:', owner.id);
        
        // Get earnings breakdown by month
        const earnings = await runQuery(`
            SELECT 
                strftime('%Y-%m', b.created_at) as month,
                COALESCE(SUM(b.total_amount * 0.8), 0) as earnings,
                COALESCE(COUNT(*), 0) as bookings
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed'
            GROUP BY strftime('%Y-%m', b.created_at)
            ORDER BY month DESC
        `, [owner.id]);
        
        console.log('Earnings data:', earnings);
        
        // Get today's sales
        const todaySales = await getRow(`
            SELECT COALESCE(SUM(b.total_amount * 0.8), 0) as today_sales
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed' 
            AND date(b.created_at) = date('now')
        `, [owner.id]);
        
        console.log('Today sales:', todaySales);
        
        // Get court demand analysis
        const courtDemand = await runQuery(`
            SELECT 
                c.name,
                COALESCE(COUNT(b.id), 0) as bookings,
                COALESCE(SUM(b.total_amount * 0.8), 0) as revenue
            FROM courts c
            LEFT JOIN bookings b ON c.id = b.court_id AND b.booking_status = 'confirmed'
            WHERE c.owner_id = ?
            GROUP BY c.id, c.name
            ORDER BY bookings DESC
        `, [owner.id]);
        
        console.log('Court demand:', courtDemand);
        
        // Separate high and low demand courts
        const totalCourts = courtDemand.length;
        const highDemandThreshold = Math.ceil(totalCourts * 0.3); // Top 30%
        const lowDemandThreshold = Math.ceil(totalCourts * 0.7); // Bottom 30%
        
        const highDemand = courtDemand.slice(0, highDemandThreshold);
        const lowDemand = courtDemand.slice(-lowDemandThreshold).reverse();
        
        // Get recent bookings
        const recentBookings = await runQuery(`
            SELECT 
                b.id,
                c.name as court_name,
                (u.first_name || ' ' || u.last_name) as player_name,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_amount
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN users u ON b.user_id = u.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed'
            ORDER BY b.created_at DESC
            LIMIT 10
        `, [owner.id]);
        
        console.log('Recent bookings:', recentBookings);
        
        // Get sales trend data (yearly by month)
        const yearlySales = await runQuery(`
            SELECT 
                strftime('%m', b.created_at) as month_num,
                strftime('%Y-%m', b.created_at) as month,
                COALESCE(SUM(b.total_amount * 0.8), 0) as sales
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed'
            AND strftime('%Y', b.created_at) = strftime('%Y', 'now')
            GROUP BY strftime('%Y-%m', b.created_at)
            ORDER BY month_num ASC
        `, [owner.id]);
        
        console.log('Yearly sales:', yearlySales);
        
        // Get monthly sales data (current month by day)
        const monthlySales = await runQuery(`
            SELECT 
                strftime('%d', b.created_at) as day,
                COALESCE(SUM(b.total_amount * 0.8), 0) as sales
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed'
            AND strftime('%Y-%m', b.created_at) = strftime('%Y-%m', 'now')
            GROUP BY strftime('%d', b.created_at)
            ORDER BY day ASC
        `, [owner.id]);
        
        console.log('Monthly sales:', monthlySales);
        
        // Get booking trend by day of week
        const bookingTrend = await runQuery(`
            SELECT 
                strftime('%w', b.booking_date) as day_of_week,
                COALESCE(COUNT(*), 0) as bookings
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ? AND b.booking_status = 'confirmed'
            AND b.created_at >= datetime('now', '-30 days')
            GROUP BY strftime('%w', b.booking_date)
            ORDER BY day_of_week ASC
        `, [owner.id]);
        
        console.log('Booking trend:', bookingTrend);
        
        res.render('users/earnings', {
            title: 'Sales Dashboard',
            user: req.session.user,
            earnings: earnings || [],
            todaySales: (todaySales?.today_sales || 0).toFixed(2),
            courtDemand: {
                high: highDemand || [],
                low: lowDemand || []
            },
            recentBookings: recentBookings || [],
            yearlySales: yearlySales || [],
            monthlySales: monthlySales || [],
            bookingTrend: bookingTrend || []
        });
    } catch (error) {
        console.error('Sales dashboard error:', error);
        console.error('Error stack:', error.stack);
        res.render('error', {
            title: 'Error',
            error: 'Error loading sales dashboard: ' + error.message,
            user: req.session.user
        });
    }
});

// Booking History for owners
router.get('/bookings/history', requireOwner, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const owner = await getRow('SELECT * FROM court_owners WHERE user_id = ?', [userId]);
        if (!owner) {
            return res.render('error', {
                title: 'Error',
                error: 'Owner profile not found',
                user: req.session.user
            });
        }
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        // Sorting
        const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
        // Get total count
        const countRow = await getRow(`
            SELECT COUNT(*) as count
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = ?
        `, [owner.id]);
        const totalRecords = countRow.count;
        const totalPages = Math.ceil(totalRecords / limit);
        // Fetch bookings
        const bookings = await runQuery(`
            SELECT b.id as order_id, b.*, c.name as court_name, u.first_name, u.last_name, u.email
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN users u ON b.user_id = u.id
            WHERE c.owner_id = ?
            ORDER BY b.booking_date ${sort}, b.start_time ${sort}
            LIMIT ? OFFSET ?
        `, [owner.id, limit, offset]);
        res.render('users/booking-history', {
            title: 'Booking History',
            user: req.session.user,
            bookings,
            page,
            totalPages,
            sort
        });
    } catch (error) {
        console.error('Booking history error:', error);
        res.render('error', {
            title: 'Error',
            error: 'Error loading booking history',
            user: req.session.user
        });
    }
});

module.exports = router; 
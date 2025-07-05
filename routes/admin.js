const express = require('express');
const { runQuery, getRow, run } = require('../database/db');
const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).render('error', { 
            error: 'Access denied. Admin privileges required.',
            user: req.session.user
        });
    }
};

// Admin dashboard
router.get('/', requireAdmin, async (req, res) => {
    try {
        // Get statistics
        const stats = await getRow(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'owner') as total_owners,
                (SELECT COUNT(*) FROM courts WHERE is_approved = 1) as approved_courts,
                (SELECT COUNT(*) FROM courts WHERE is_approved = 0) as pending_courts,
                (SELECT COUNT(*) FROM bookings WHERE booking_status = 'confirmed') as total_bookings,
                (SELECT SUM(total_amount) FROM bookings WHERE payment_status = 'paid') as total_revenue
        `);
        
        // Get recent bookings
        const recentBookings = await runQuery(`
            SELECT b.*, c.name as court_name, u.first_name, u.last_name
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN users u ON b.user_id = u.id
            ORDER BY b.created_at DESC
            LIMIT 10
        `);
        
        // Get pending court approvals
        const pendingCourts = await runQuery(`
            SELECT c.*, co.business_name, u.first_name, u.last_name
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            JOIN users u ON co.user_id = u.id
            WHERE c.is_approved = 0
            ORDER BY c.created_at DESC
        `);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user,
            stats,
            recentBookings,
            pendingCourts
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.render('error', {
            error: 'Error loading admin dashboard',
            user: req.session.user
        });
    }
});

// Manage users
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await runQuery(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as booking_count
            FROM users u
            ORDER BY u.created_at DESC
        `);
        
        res.render('admin/users', {
            title: 'Manage Users',
            user: req.session.user,
            users
        });
    } catch (error) {
        console.error('Users management error:', error);
        res.render('error', {
            error: 'Error loading users',
            user: req.session.user
        });
    }
});

// Update user status
router.post('/users/:id/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const userId = req.params.id;
        
        await run(
            'UPDATE users SET is_active = ? WHERE id = ?',
            [status === 'active' ? 1 : 0, userId]
        );
        
        res.json({ success: true, message: 'User status updated' });
    } catch (error) {
        console.error('User status update error:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
});

// Manage courts
router.get('/courts', requireAdmin, async (req, res) => {
    try {
        const courts = await runQuery(`
            SELECT c.*, co.business_name, u.first_name, u.last_name,
                   (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) as booking_count,
                   (SELECT AVG(rating) FROM reviews WHERE court_id = c.id) as avg_rating
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            JOIN users u ON co.user_id = u.id
            ORDER BY c.created_at DESC
        `);
        
        res.render('admin/courts', {
            title: 'Manage Courts',
            user: req.session.user,
            courts
        });
    } catch (error) {
        console.error('Courts management error:', error);
        res.render('error', {
            error: 'Error loading courts',
            user: req.session.user
        });
    }
});

// Approve/reject court
router.post('/courts/:id/approve', requireAdmin, async (req, res) => {
    try {
        const { approved } = req.body;
        const courtId = req.params.id;
        
        await run(
            'UPDATE courts SET is_approved = ? WHERE id = ?',
            [approved === 'true' ? 1 : 0, courtId]
        );
        
        res.json({ success: true, message: `Court ${approved === 'true' ? 'approved' : 'rejected'}` });
    } catch (error) {
        console.error('Court approval error:', error);
        res.status(500).json({ error: 'Error updating court approval' });
    }
});

// Manage bookings
router.get('/bookings', requireAdmin, async (req, res) => {
    try {
        const bookings = await runQuery(`
            SELECT b.*, c.name as court_name, co.business_name,
                   u.first_name, u.last_name, u.email
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN court_owners co ON c.owner_id = co.id
            JOIN users u ON b.user_id = u.id
            ORDER BY b.created_at DESC
        `);
        
        res.render('admin/bookings', {
            title: 'Manage Bookings',
            user: req.session.user,
            bookings
        });
    } catch (error) {
        console.error('Bookings management error:', error);
        res.render('error', {
            error: 'Error loading bookings',
            user: req.session.user
        });
    }
});

// Analytics
router.get('/analytics', requireAdmin, async (req, res) => {
    try {
        // Monthly revenue
        const monthlyRevenue = await runQuery(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                SUM(total_amount) as revenue,
                COUNT(*) as bookings
            FROM bookings 
            WHERE payment_status = 'paid'
            GROUP BY strftime('%Y-%m', created_at)
            ORDER BY month DESC
            LIMIT 12
        `);
        
        // Popular courts
        const popularCourts = await runQuery(`
            SELECT c.name, co.business_name,
                   COUNT(b.id) as booking_count,
                   AVG(r.rating) as avg_rating
            FROM courts c
            JOIN court_owners co ON c.owner_id = co.id
            LEFT JOIN bookings b ON c.id = b.court_id
            LEFT JOIN reviews r ON c.id = r.court_id
            WHERE c.is_approved = 1
            GROUP BY c.id
            ORDER BY booking_count DESC
            LIMIT 10
        `);
        
        // User registration trends
        const userTrends = await runQuery(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                COUNT(*) as registrations,
                role
            FROM users 
            GROUP BY strftime('%Y-%m', created_at), role
            ORDER BY month DESC
            LIMIT 12
        `);
        
        res.render('admin/analytics', {
            title: 'Analytics',
            user: req.session.user,
            monthlyRevenue,
            popularCourts,
            userTrends
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.render('error', {
            error: 'Error loading analytics',
            user: req.session.user
        });
    }
});

// Payouts management
router.get('/payouts', requireAdmin, async (req, res) => {
    try {
        const payouts = await runQuery(`
            SELECT p.*, co.business_name, u.first_name, u.last_name
            FROM payouts p
            JOIN court_owners co ON p.owner_id = co.id
            JOIN users u ON co.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        
        // Calculate pending amounts for each owner
        const pendingAmounts = await runQuery(`
            SELECT co.id, co.business_name,
                   SUM(b.total_amount * 0.8) as pending_amount
            FROM court_owners co
            JOIN courts c ON co.id = c.owner_id
            JOIN bookings b ON c.id = b.court_id
            WHERE b.payment_status = 'paid' 
            AND b.booking_date < date('now', '-7 days')
            AND NOT EXISTS (
                SELECT 1 FROM payouts p 
                WHERE p.owner_id = co.id 
                AND p.created_at > b.created_at
            )
            GROUP BY co.id
        `);
        
        res.render('admin/payouts', {
            title: 'Manage Payouts',
            user: req.session.user,
            payouts,
            pendingAmounts
        });
    } catch (error) {
        console.error('Payouts error:', error);
        res.render('error', {
            error: 'Error loading payouts',
            user: req.session.user
        });
    }
});

// Process payout
router.post('/payouts/process', requireAdmin, async (req, res) => {
    try {
        const { owner_id, amount } = req.body;
        
        await run(`
            INSERT INTO payouts (owner_id, amount, status, payout_date)
            VALUES (?, ?, ?, datetime('now'))
        `, [owner_id, amount, 'completed']);
        
        res.json({ success: true, message: 'Payout processed successfully' });
    } catch (error) {
        console.error('Payout processing error:', error);
        res.status(500).json({ error: 'Error processing payout' });
    }
});

module.exports = router; 
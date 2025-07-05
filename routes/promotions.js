const express = require('express');
const router = express.Router();
const { runQuery, getRow, run } = require('../database/db');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/auth/login');
    }
};

// Middleware to check if user is admin or owner
const requireAdminOrOwner = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'owner')) {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access denied',
            error: 'Access denied. Admin or Owner privileges required.',
            user: req.session.user
        });
    }
};

// Middleware to check if user is a regular user
const requireUser = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'user') {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access denied',
            error: 'Access denied. Regular user privileges required.',
            user: req.session.user
        });
    }
};

// Promotions index page
router.get('/', requireAdminOrOwner, async (req, res) => {
    try {
        const promotions = await runQuery(`
            SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
                   COUNT(pt.user_id) as target_count
            FROM promotions p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN promotion_targets pt ON p.id = pt.promotion_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);

        res.render('promotions/index', {
            title: 'Manage Promotions',
            user: req.session.user,
            promotions
        });
    } catch (error) {
        console.error('Promotions error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load promotions',
            user: req.session.user
        });
    }
});

// Create promotion page
router.get('/create', requireAdminOrOwner, async (req, res) => {
    try {
        // Get all users for target selection
        const users = await runQuery('SELECT id, first_name, last_name, email FROM users WHERE role = "user" ORDER BY first_name, last_name');
        
        res.render('promotions/create', {
            title: 'Create Promotion',
            user: req.session.user,
            users
        });
    } catch (error) {
        console.error('Create promotion error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load create promotion page',
            user: req.session.user
        });
    }
});

// Create promotion
router.post('/create', requireAdminOrOwner, async (req, res) => {
    try {
        const {
            code,
            title,
            description,
            discount_type,
            discount_value,
            min_booking_amount,
            max_discount_amount,
            start_date,
            end_date,
            usage_limit,
            target_type,
            target_users
        } = req.body;

        // Validation
        if (!code || !title || !discount_type || !discount_value || !start_date || !end_date) {
            return res.render('promotions/create', {
                title: 'Create Promotion',
                user: req.session.user,
                error: 'Please fill in all required fields',
                formData: req.body
            });
        }

        // Check if code already exists
        const existingCode = await getRow('SELECT id FROM promotions WHERE code = ?', [code]);
        if (existingCode) {
            return res.render('promotions/create', {
                title: 'Create Promotion',
                user: req.session.user,
                error: 'Promotion code already exists',
                formData: req.body
            });
        }

        // Insert promotion
        const result = await run(`
            INSERT INTO promotions (
                code, title, description, discount_type, discount_value, 
                min_booking_amount, max_discount_amount, start_date, end_date,
                usage_limit, created_by, target_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code.toUpperCase(), title, description, discount_type, discount_value,
            min_booking_amount || 0, max_discount_amount || null, start_date, end_date,
            usage_limit || -1, req.session.user.id, target_type || 'all'
        ]);

        // Add target users if specific
        if (target_type === 'specific' && target_users && target_users.length > 0) {
            for (const userId of target_users) {
                await run('INSERT INTO promotion_targets (promotion_id, user_id) VALUES (?, ?)', [result.id, userId]);
            }
        }

        res.redirect('/promotions?success=Promotion created successfully');
    } catch (error) {
        console.error('Create promotion error:', error);
        res.render('promotions/create', {
            title: 'Create Promotion',
            user: req.session.user,
            error: 'Failed to create promotion',
            formData: req.body
        });
    }
});

// Edit promotion page
router.get('/edit/:id', requireAdminOrOwner, async (req, res) => {
    try {
        const { id } = req.params;
        
        const promotion = await getRow(`
            SELECT * FROM promotions WHERE id = ?
        `, [id]);

        if (!promotion) {
            return res.status(404).render('error', { 
                title: 'Not Found',
                error: 'Promotion not found',
                user: req.session.user
            });
        }

        // Get target users
        const targetUsers = await runQuery(`
            SELECT pt.user_id, u.first_name, u.last_name, u.email
            FROM promotion_targets pt
            JOIN users u ON pt.user_id = u.id
            WHERE pt.promotion_id = ?
        `, [id]);

        // Get all users for selection
        const users = await runQuery('SELECT id, first_name, last_name, email FROM users WHERE role = "user" ORDER BY first_name, last_name');

        res.render('promotions/edit', {
            title: 'Edit Promotion',
            user: req.session.user,
            promotion,
            targetUsers,
            users
        });
    } catch (error) {
        console.error('Edit promotion error:', error);
        res.status(500).render('error', { 
            title: 'Error',
            error: 'Failed to load promotion',
            user: req.session.user
        });
    }
});

// Update promotion
router.post('/edit/:id', requireAdminOrOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            title,
            description,
            discount_type,
            discount_value,
            min_booking_amount,
            max_discount_amount,
            start_date,
            end_date,
            usage_limit,
            target_type,
            target_users
        } = req.body;

        // Validation
        if (!code || !title || !discount_type || !discount_value || !start_date || !end_date) {
            return res.render('promotions/edit', {
                title: 'Edit Promotion',
                user: req.session.user,
                error: 'Please fill in all required fields',
                promotion: { id, ...req.body }
            });
        }

        // Check if code already exists (excluding current promotion)
        const existingCode = await getRow('SELECT id FROM promotions WHERE code = ? AND id != ?', [code, id]);
        if (existingCode) {
            return res.render('promotions/edit', {
                title: 'Edit Promotion',
                user: req.session.user,
                error: 'Promotion code already exists',
                promotion: { id, ...req.body }
            });
        }

        // Update promotion
        await run(`
            UPDATE promotions SET
                code = ?, title = ?, description = ?, discount_type = ?, discount_value = ?,
                min_booking_amount = ?, max_discount_amount = ?, start_date = ?, end_date = ?,
                usage_limit = ?, target_type = ?
            WHERE id = ?
        `, [
            code.toUpperCase(), title, description, discount_type, discount_value,
            min_booking_amount || 0, max_discount_amount || null, start_date, end_date,
            usage_limit || -1, target_type || 'all', id
        ]);

        // Update target users
        await run('DELETE FROM promotion_targets WHERE promotion_id = ?', [id]);
        if (target_type === 'specific' && target_users && target_users.length > 0) {
            for (const userId of target_users) {
                await run('INSERT INTO promotion_targets (promotion_id, user_id) VALUES (?, ?)', [id, userId]);
            }
        }

        res.redirect('/promotions?success=Promotion updated successfully');
    } catch (error) {
        console.error('Update promotion error:', error);
        res.render('promotions/edit', {
            title: 'Edit Promotion',
            user: req.session.user,
            error: 'Failed to update promotion',
            promotion: { id: req.params.id, ...req.body }
        });
    }
});

// Toggle promotion status
router.post('/toggle/:id', requireAdminOrOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const promotion = await getRow('SELECT is_active FROM promotions WHERE id = ?', [id]);
        
        if (!promotion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }

        await run('UPDATE promotions SET is_active = ? WHERE id = ?', [!promotion.is_active, id]);
        res.json({ success: true, is_active: !promotion.is_active });
    } catch (error) {
        console.error('Toggle promotion error:', error);
        res.status(500).json({ error: 'Failed to toggle promotion' });
    }
});

// Delete promotion
router.post('/delete/:id', requireAdminOrOwner, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete related records first
        await run('DELETE FROM promotion_targets WHERE promotion_id = ?', [id]);
        await run('DELETE FROM voucher_usage WHERE promotion_id = ?', [id]);
        await run('DELETE FROM promotions WHERE id = ?', [id]);

        res.redirect('/promotions?success=Promotion deleted successfully');
    } catch (error) {
        console.error('Delete promotion error:', error);
        res.redirect('/promotions?error=Failed to delete promotion');
    }
});

// Validate voucher code (API endpoint for booking form)
router.post('/validate', requireAuth, async (req, res) => {
    try {
        const { code, booking_amount } = req.body;
        
        if (!code) {
            return res.json({ valid: false, error: 'Please enter a voucher code' });
        }

        const promotion = await getRow(`
            SELECT p.*, COUNT(pt.user_id) as target_count
            FROM promotions p
            LEFT JOIN promotion_targets pt ON p.id = pt.promotion_id
            WHERE p.code = ? AND p.is_active = 1
            GROUP BY p.id
        `, [code.toUpperCase()]);

        if (!promotion) {
            return res.json({ valid: false, error: 'Invalid voucher code' });
        }

        // Check if promotion is active
        const now = new Date();
        const startDate = new Date(promotion.start_date);
        const endDate = new Date(promotion.end_date);

        if (now < startDate || now > endDate) {
            return res.json({ valid: false, error: 'Voucher is not active' });
        }

        // Check usage limit
        if (promotion.usage_limit > 0 && promotion.used_count >= promotion.usage_limit) {
            return res.json({ valid: false, error: 'Voucher usage limit reached' });
        }

        // Check minimum booking amount
        if (booking_amount < promotion.min_booking_amount) {
            return res.json({ 
                valid: false, 
                error: `Minimum booking amount required: RM${promotion.min_booking_amount}` 
            });
        }

        // Check if user is eligible
        if (promotion.target_type === 'specific') {
            const isEligible = await getRow(`
                SELECT id FROM promotion_targets 
                WHERE promotion_id = ? AND user_id = ?
            `, [promotion.id, req.session.user.id]);

            if (!isEligible) {
                return res.json({ valid: false, error: 'You are not eligible for this voucher' });
            }
        }

        // Calculate discount
        let discountAmount = 0;
        if (promotion.discount_type === 'percentage') {
            discountAmount = (booking_amount * promotion.discount_value) / 100;
            if (promotion.max_discount_amount) {
                discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
            }
        } else {
            discountAmount = promotion.discount_value;
        }

        const finalAmount = Math.max(0, booking_amount - discountAmount);

        res.json({
            valid: true,
            promotion: {
                id: promotion.id,
                title: promotion.title,
                discount_type: promotion.discount_type,
                discount_value: promotion.discount_value,
                discount_amount: discountAmount,
                final_amount: finalAmount
            }
        });
    } catch (error) {
        console.error('Validate voucher error:', error);
        res.json({ valid: false, error: 'Failed to validate voucher' });
    }
});

// Show available vouchers for the logged-in user
router.get('/available', requireUser, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const today = new Date().toISOString().slice(0, 10);
        // Fetch all active, valid, and eligible promotions for this user
        const promotions = await runQuery(`
            SELECT p.*
            FROM promotions p
            LEFT JOIN promotion_targets pt ON p.id = pt.promotion_id
            WHERE p.is_active = 1
              AND p.start_date <= ?
              AND p.end_date >= ?
              AND (
                p.target_type = 'all'
                OR (p.target_type = 'specific' AND pt.user_id = ?)
              )
        `, [today, today, userId]);

        res.render('promotions/available', {
            title: 'Available Vouchers',
            user: req.session.user,
            promotions
        });
    } catch (error) {
        console.error('Available vouchers error:', error);
        res.render('error', {
            error: 'Error loading available vouchers',
            user: req.session.user
        });
    }
});

// API: Get eligible vouchers for booking context
router.post('/eligible', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'user') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.session.user.id;
        const { booking_date, booking_amount } = req.body;
        const today = booking_date || new Date().toISOString().slice(0, 10);
        const amount = booking_amount || 0;
        // Fetch all active, valid, and eligible promotions for this user and booking
        const promotions = await runQuery(`
            SELECT p.*
            FROM promotions p
            LEFT JOIN promotion_targets pt ON p.id = pt.promotion_id
            WHERE p.is_active = 1
              AND p.start_date <= ?
              AND p.end_date >= ?
              AND (
                p.target_type = 'all'
                OR (p.target_type = 'specific' AND pt.user_id = ?)
              )
              AND (p.min_booking_amount IS NULL OR p.min_booking_amount <= ?)
        `, [today, today, userId, amount]);
        res.json({ success: true, promotions });
    } catch (error) {
        console.error('Eligible vouchers API error:', error);
        res.status(500).json({ error: 'Error fetching eligible vouchers' });
    }
});

module.exports = router; 
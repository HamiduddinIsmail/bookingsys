const express = require('express');
const bcrypt = require('bcryptjs');
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

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access denied',
            error: 'Access denied. Admin privileges required.',
            user: req.session.user
        });
    }
};

// Middleware to check if user is court owner
const requireOwner = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'owner') {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access denied',
            error: 'Access denied. Court owner privileges required.',
            user: req.session.user
        });
    }
};

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { 
        title: 'Login',
        error: req.query.error,
        user: req.session.user
    });
});

// Login process
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Get user from database
        const user = await getRow(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (!user) {
            return res.render('auth/login', { 
                title: 'Login',
                error: 'Invalid username or password',
                user: req.session.user
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('auth/login', { 
                title: 'Login',
                error: 'Invalid username or password',
                user: req.session.user
            });
        }

        // Set session
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
        };

        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', { 
            title: 'Login',
            error: 'An error occurred during login',
            user: req.session.user
        });
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', { 
        title: 'Register',
        error: req.query.error,
        user: req.session.user
    });
});

// Register process
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirm_password, first_name, last_name, role } = req.body;

        // Validation
        if (password !== confirm_password) {
            return res.render('auth/register', { 
                title: 'Register',
                error: 'Passwords do not match',
                user: req.session.user
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', { 
                title: 'Register',
                error: 'Password must be at least 6 characters long',
                user: req.session.user
            });
        }

        // Check if user already exists
        const existingUser = await getRow(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return res.render('auth/register', { 
                title: 'Register',
                error: 'Username or email already exists',
                user: req.session.user
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await run(
            `INSERT INTO users (username, email, password, first_name, last_name, role) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, first_name, last_name, role || 'user']
        );

        // If user is a court owner, create court owner profile
        if (role === 'owner') {
            await run(
                'INSERT INTO court_owners (user_id, business_name) VALUES (?, ?)',
                [result.id, `${first_name} ${last_name}'s Courts`]
            );
        }

        res.redirect('/auth/login?success=Registration successful! Please login.');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', { 
            title: 'Register',
            error: 'An error occurred during registration',
            user: req.session.user
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await getRow('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        
        // Get additional info based on role
        let additionalInfo = null;
        if (user.role === 'owner') {
            additionalInfo = await getRow(
                'SELECT * FROM court_owners WHERE user_id = ?', 
                [user.id]
            );
        }

        res.render('auth/profile', { 
            title: 'Profile',
            user: req.session.user,
            userData: user,
            additionalInfo
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.render('error', { 
            title: 'Error',
            error: 'Error loading profile',
            user: req.session.user
        });
    }
});

// Update profile
router.post('/profile', requireAuth, async (req, res) => {
    try {
        const { first_name, last_name, phone, address } = req.body;
        
        await run(
            'UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ? WHERE id = ?',
            [first_name, last_name, phone, address, req.session.user.id]
        );

        // Update session
        req.session.user.first_name = first_name;
        req.session.user.last_name = last_name;

        res.redirect('/auth/profile?success=Profile updated successfully!');
    } catch (error) {
        console.error('Profile update error:', error);
        res.redirect('/auth/profile?error=Error updating profile');
    }
});

module.exports = router; 
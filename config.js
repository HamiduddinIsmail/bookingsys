// Configuration for Badminton Court Booking Platform

module.exports = {
    // Server Configuration
    port: process.env.PORT || 3000,
    
    // Database Configuration
    database: {
        path: './database/badminton_courts.db'
    },
    
    // Session Configuration
    session: {
        secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    },
    
    // Payment Configuration (Stripe)
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_test_key_here',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_stripe_publishable_key_here'
    },
    
    // Google Maps Configuration
    googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || 'your_google_maps_api_key_here'
    },
    
    // Application Settings
    app: {
        name: 'Badminton Court Booking Platform',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    },
    
    // File Upload Configuration
    upload: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        uploadPath: './uploads/'
    },
    
    // Email Configuration (for future use)
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER || 'your_email@gmail.com',
            pass: process.env.EMAIL_PASS || 'your_email_password'
        }
    }
}; 
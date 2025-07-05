# Badminton Court Booking Platform - Setup Guide

## 🚀 Quick Start

Your badminton court booking platform is now ready! Here's how to get started:

### 1. Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

### 2. Default Login Credentials

The system comes with three default accounts for testing:

#### 👑 Platform Admin
- **Username:** `admin`
- **Password:** `admin123`
- **Access:** Full system administration

#### 🏢 Court Owner
- **Username:** `owner1`
- **Password:** `owner123`
- **Access:** Court management and bookings

#### 👤 End User
- **Username:** `user1`
- **Password:** `user123`
- **Access:** Court booking and reviews

### 3. Key Features Available

#### For End Users:
- ✅ Search and filter courts by location, amenities
- ✅ View court details, photos, and reviews
- ✅ Book courts with time slot selection
- ✅ Manage bookings and submit reviews
- ✅ User registration and profile management

#### For Court Owners:
- ✅ Court listing and management
- ✅ Booking management and notifications
- ✅ Earnings tracking and reports
- ✅ Court availability management

#### For Platform Admins:
- ✅ User and court management
- ✅ Booking oversight and analytics
- ✅ Payment and payout management
- ✅ System-wide statistics

### 4. Next Steps

#### Add Sample Data:
1. **Login as Court Owner** (`owner1` / `owner123`)
2. **Add Courts:** Go to "My Courts" and add some sample courts
3. **Login as Admin** (`admin` / `admin123`)
4. **Approve Courts:** Go to Admin Dashboard and approve the courts

#### Test the Booking Flow:
1. **Login as User** (`user1` / `user123`)
2. **Search Courts:** Browse available courts
3. **Make a Booking:** Select a court, date, and time
4. **Complete Payment:** Test the booking process

### 5. Customization Options

#### Environment Variables:
Create a `.env` file in the root directory:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key
STRIPE_SECRET_KEY=your_stripe_secret_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NODE_ENV=development
```

#### Database:
- The application uses SQLite for simplicity
- Database file: `database/badminton_courts.db`
- To reset: Delete the database file and run `npm run init-db`

### 6. Production Deployment

For production deployment, consider:

1. **Database:** Switch to PostgreSQL or MySQL
2. **File Storage:** Use cloud storage (AWS S3, Google Cloud)
3. **Email:** Configure SMTP for notifications
4. **Payment:** Set up Stripe production keys
5. **SSL:** Enable HTTPS
6. **Environment:** Set NODE_ENV=production

### 7. File Structure

```
badminton-court-booking/
├── database/           # Database files and initialization
├── public/            # Static files (CSS, JS, images)
├── routes/            # API routes
├── views/             # HTML templates
├── server.js          # Main server file
├── package.json       # Dependencies
└── README.md          # Documentation
```

### 8. Troubleshooting

#### Common Issues:

**Server won't start:**
- Check if port 3000 is available
- Ensure all dependencies are installed: `npm install`

**Database errors:**
- Reinitialize database: `npm run init-db`
- Check file permissions on database folder

**Login issues:**
- Use the default credentials provided above
- Check browser console for errors

**Page not found:**
- Ensure all route files are properly created
- Check server logs for routing errors

### 9. Development Commands

```bash
# Start development server
npm run dev

# Start production server
npm start

# Initialize database
npm run init-db

# Install dependencies
npm install
```

### 10. Support

If you encounter any issues:
1. Check the browser console for JavaScript errors
2. Review server logs in the terminal
3. Ensure all files are properly created
4. Verify database initialization completed successfully

---

## 🎉 Congratulations!

Your badminton court booking platform is now running successfully! 

You can start exploring the features, adding courts, making bookings, and customizing the platform to meet your specific needs.

Happy coding! 🏸 
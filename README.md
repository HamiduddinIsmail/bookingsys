# Badminton Court Booking Platform

A centralized web application platform where multiple badminton court owners can list their courts and users can search, compare, and book available courts based on specific preferences and locations.

## 🏸 Features

### For End Users
- Search courts by location, date, and time
- Filter by amenities (court type, indoor/outdoor, AC, parking, etc.)
- View detailed court information with photos and reviews
- Book courts with integrated payment system
- Manage bookings and submit reviews

### For Court Owners
- Register and list multiple courts
- Manage court availability and pricing
- Handle bookings and view earnings
- Set payout information

### For Platform Admins
- Manage users and court listings
- Handle disputes and payments
- View analytics and reports

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   JWT_SECRET=your_jwt_secret_here
   STRIPE_SECRET_KEY=your_stripe_secret_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

3. **Initialize Database**
   ```bash
   npm run init-db
   ```

4. **Start the Application**
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
badminton-court-booking/
├── public/                 # Static files (CSS, JS, images)
├── views/                  # HTML templates
├── database/              # Database setup and queries
├── routes/                # API routes
├── middleware/            # Custom middleware
├── uploads/               # File uploads
├── server.js             # Main server file
└── package.json          # Dependencies
```

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Payment**: Stripe
- **Maps**: Google Maps API
- **Authentication**: JWT

## 👥 User Roles

1. **Platform Admin**: Full system access
2. **Court Owner**: Manage courts and bookings
3. **End User**: Search and book courts

## 📝 License

MIT License 
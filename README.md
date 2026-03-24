# SalonPro - Complete Salon Management System

A Progressive Web Application (PWA) designed to streamline salon operations, including appointment scheduling, inventory management, staff performance tracking, and automated billing.

## 🚀 Features
- **Dashboard**: Real-time business insights and daily summaries.
- **Calendar**: Visual appointment scheduling and staff assignment.
- **Client Management**: CRM system with visit history and spending analytics.
- **Inventory Control**: Low stock alerts and supplier management.
- **Smart Billing**: Automated invoice generation with tax and commission calculation.
- **Reporting**: Detailed analytics for revenue, sales, and staff performance.
- **PWA Ready**: Installable on mobile and desktop with offline support.

## 🛠 Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Security**: JWT Authentication, Bcrypt password hashing, Helmet security headers, CORS protection.

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16+)
- MongoDB (Local or Atlas)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd complete_salon_management
```

### 2. Backend Setup
```bash
cd salon-backend
npm install
```

Create a `.env` file in the `salon-backend` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
CLIENT_URL=http://localhost:5000  # In production, change to your domain
```

### 3. Start the Application
#### Backend:
```bash
npm run dev
```

#### Frontend:
Simply open `index.html` in your browser (via a local server like Live Server) or serve it using your preferred method.

## 📖 License
MIT License - Developed for SalonPro Management.

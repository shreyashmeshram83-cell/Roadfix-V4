# RoadFix Complaint Management System - Backend

A comprehensive backend API for transparent complaint flow tracking and management.

## Features

### 🔄 Transparent Complaint Flow Tracking
- **Unique Complaint IDs** for easy tracking
- **Real-time Status Updates** (Pending → In Progress → Resolved)
- **Complete Timeline History** with timestamps
- **Office & Officer Assignment** tracking
- **Automated History Logging** for all actions

### 👥 User Management
- **Role-based Access Control** (User, Officer, Admin)
- **Secure Authentication** with JWT tokens
- **Profile Management** with detailed user information
- **Account Status Management** (Active/Inactive)

### 📊 Admin Dashboard
- **Comprehensive Analytics** and statistics
- **Bulk Operations** for efficient complaint management
- **User Management** and oversight
- **System Configuration** and settings
- **Audit Logs** for accountability

### 🛠️ Complaint Management
- **Advanced Filtering** and search capabilities
- **Multi-level Categorization** and prioritization
- **Media Attachments** support
- **AI Analysis Integration** for smart categorization
- **Voting System** with anti-spam protection

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting
- **Password Hashing**: bcryptjs

## Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── auth.js             # Authentication logic
│   ├── complaints.js       # Complaint CRUD operations
│   └── admin.js            # Admin dashboard & management
├── middleware/
│   ├── auth.js             # Authentication middleware
│   ├── errorHandler.js     # Global error handling
│   └── notFound.js         # 404 handler
├── models/
│   ├── User.js             # User schema
│   ├── Complaint.js        # Complaint schema
│   └── ComplaintHistory.js # History tracking schema
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── complaints.js       # Complaint routes
│   └── admin.js            # Admin routes
├── server.js               # Main application entry
├── package.json            # Dependencies & scripts
└── README.md              # This file
```

## Database Schema

### User Collection
```javascript
{
  username: String,
  email: String,
  password: String, // Hashed
  role: ['user', 'officer', 'admin'],
  office: String, // For officers/admins
  department: String,
  isActive: Boolean,
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    address: String
  },
  lastLogin: Date,
  timestamps: true
}
```

### Complaint Collection
```javascript
{
  complaintId: String, // Unique ID like "RFABC123DEF"
  title: String,
  description: String,
  category: ['pothole', 'street_light', 'water_supply', 'drainage', 'traffic_signal', 'other'],
  severity: ['low', 'medium', 'high', 'critical'],
  status: ['pending', 'in_progress', 'resolved', 'rejected'],
  priority: ['low', 'medium', 'high', 'urgent'],

  // Location
  location: {
    address: String,
    coordinates: { latitude: Number, longitude: Number },
    city: String, state: String, pincode: String
  },

  // Current assignment
  currentOffice: String,
  currentOfficer: ObjectId, // Reference to User

  // Media
  images: [{ url: String, filename: String, uploadedAt: Date }],

  // Metadata
  complainant: ObjectId, // Reference to User
  upvotes: Number,
  upvotedBy: [ObjectId], // Array of User references

  // AI Analysis
  aiAnalysis: {
    isPothole: Boolean,
    severity: String,
    estimatedCost: String,
    confidence: Number,
    analyzedAt: Date
  },

  // Resolution
  resolution: {
    resolvedAt: Date,
    resolvedBy: ObjectId,
    resolution: String,
    cost: Number,
    duration: Number // in days
  },

  timestamps: true
}
```

### ComplaintHistory Collection
```javascript
{
  complaintId: String,
  complaint: ObjectId, // Reference to Complaint

  // State changes
  previousStatus: String,
  previousOffice: String,
  previousOfficer: ObjectId,
  newStatus: String,
  newOffice: String,
  newOfficer: ObjectId,

  // Action details
  action: ['submitted', 'assigned', 'forwarded', 'status_updated', 'resolved', 'rejected', 'reopened'],
  actionBy: ObjectId, // Reference to User
  actionByRole: String,
  remarks: String,

  // Metadata
  timestamp: Date,
  ipAddress: String,
  userAgent: String
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Complaints
- `POST /api/complaints` - Create new complaint
- `GET /api/complaints` - Get complaints (with filters)
- `GET /api/complaints/:id` - Get single complaint
- `GET /api/complaints/:id/timeline` - Get complaint timeline
- `PUT /api/complaints/:id/status` - Update complaint status (Officers/Admin)
- `PUT /api/complaints/:id/forward` - Forward complaint (Officers/Admin)
- `POST /api/complaints/:id/remarks` - Add remarks (Officers/Admin)
- `POST /api/complaints/:id/upvote` - Upvote complaint (Users)

### Admin
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - User management
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/settings` - System settings
- `PUT /api/admin/settings` - Update system settings
- `GET /api/admin/audit-logs` - Audit logs
- `POST /api/admin/bulk-operation` - Bulk operations on complaints

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/roadfix
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=30d
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   ```bash
   npm run dev  # Development mode with nodemon
   npm start    # Production mode
   ```

## Usage Examples

### Create a Complaint
```javascript
POST /api/complaints
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Large pothole on Main Street",
  "description": "There's a dangerous pothole causing traffic issues",
  "category": "pothole",
  "severity": "high",
  "location": {
    "address": "Main Street, Near Central Mall, City Center",
    "coordinates": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "filename": "pothole1.jpg"
    }
  ]
}
```

### Get Complaint Timeline
```javascript
GET /api/complaints/RFABC123DEF/timeline
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "complaintId": "RFABC123DEF",
      "action": "submitted",
      "actionDescription": "Complaint submitted",
      "actionBy": {
        "username": "john_doe",
        "profile": {
          "firstName": "John",
          "lastName": "Doe"
        }
      },
      "remarks": "Complaint submitted by user",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "formattedTimestamp": "15 January 2024, 10:30:00 AM"
    },
    {
      "complaintId": "RFABC123DEF",
      "action": "assigned",
      "actionDescription": "Assigned to officer",
      "previousOffice": "Municipal Office",
      "newOffice": "Road Department",
      "newOfficer": {
        "username": "officer_smith",
        "profile": {
          "firstName": "Jane",
          "lastName": "Smith"
        }
      },
      "actionBy": {
        "username": "admin",
        "role": "admin"
      },
      "remarks": "Assigned to road maintenance officer",
      "timestamp": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

### Update Complaint Status
```javascript
PUT /api/complaints/RFABC123DEF/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",
  "remarks": "Officer assigned and investigation started",
  "priority": "high"
}
```

### Bulk Operations (Admin)
```javascript
POST /api/admin/bulk-operation
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "operation": "update_status",
  "complaintIds": ["RFABC123DEF", "RFXYZ456UVW"],
  "data": {
    "status": "resolved",
    "remarks": "Bulk resolution for completed repairs"
  }
}
```

## Security Features

- **JWT Authentication** with secure token handling
- **Password Hashing** using bcryptjs
- **Rate Limiting** to prevent abuse
- **Input Validation** and sanitization
- **CORS Protection** with configurable origins
- **Helmet Security Headers** for additional protection
- **Role-based Access Control** (RBAC)

## Error Handling

The API uses consistent error response format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"] // For validation errors
}
```

## Production Deployment

1. **Environment Variables**: Set production values for all environment variables
2. **Database**: Use MongoDB Atlas or a production MongoDB instance
3. **SSL/TLS**: Enable HTTPS in production
4. **Logging**: Implement proper logging (Winston recommended)
5. **Monitoring**: Add health checks and monitoring
6. **Backup**: Regular database backups
7. **Scaling**: Consider load balancing for high traffic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.</content>
<parameter name="filePath">c:\Users\Shreyash Meshram\Desktop\roadfix--v2\backend\README.md
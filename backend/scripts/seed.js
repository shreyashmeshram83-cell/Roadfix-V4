const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ComplaintHistory = require('../models/ComplaintHistory');
require('dotenv').config();

const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@roadfix.com',
    password: 'admin123',
    role: 'admin',
    office: 'Municipal Corporation',
    department: 'Administration',
    profile: {
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+91-9876543210'
    }
  },
  {
    username: 'user_john',
    email: 'john.doe@example.com',
    password: 'user123',
    role: 'user',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+91-9876543213',
      address: '123 Main Street, City Center'
    }
  },
  {
    username: 'user_sarah',
    email: 'sarah.wilson@example.com',
    password: 'user123',
    role: 'user',
    profile: {
      firstName: 'Sarah',
      lastName: 'Wilson',
      phone: '+91-9876543214',
      address: '456 Oak Avenue, Downtown'
    }
  }
];

const sampleComplaints = [
  {
    title: 'Large pothole on Main Street causing accidents',
    description: 'There is a very large pothole on Main Street near the Central Mall that has been there for weeks. It\'s causing vehicles to swerve dangerously and could lead to accidents. Several people have already reported damage to their vehicles.',
    category: 'pothole',
    severity: 'high',
    status: 'in_progress',
    priority: 'high',
    location: {
      address: 'Main Street, Near Central Mall, City Center',
      coordinates: { latitude: 28.6139, longitude: 77.2090 },
      city: 'Delhi', state: 'Delhi', pincode: '110001'
    },
    upvotes: 12,
    aiAnalysis: {
      isPothole: true,
      severity: 'high',
      estimatedCost: '₹15,000 - ₹25,000',
      confidence: 0.92,
      analyzedAt: new Date()
    }
  },
  {
    title: 'Street light not working for 2 weeks',
    description: 'The street light at the intersection of Oak Avenue and Pine Street has been out for two weeks. This is creating safety concerns, especially at night when visibility is poor.',
    category: 'street_light',
    severity: 'medium',
    status: 'pending',
    priority: 'medium',
    location: {
      address: 'Intersection of Oak Avenue and Pine Street',
      coordinates: { latitude: 28.6229, longitude: 77.2190 },
      city: 'Delhi', state: 'Delhi', pincode: '110002'
    },
    upvotes: 8,
    aiAnalysis: {
      isPothole: false,
      severity: 'medium',
      estimatedCost: '₹2,000 - ₹5,000',
      confidence: 0.78,
      analyzedAt: new Date()
    }
  },
  {
    title: 'Water supply interruption in residential area',
    description: 'Water supply has been intermittent in our residential colony for the past 3 days. This is causing significant inconvenience to residents, especially during peak hours.',
    category: 'water_supply',
    severity: 'high',
    status: 'in_progress',
    priority: 'urgent',
    location: {
      address: 'Green Valley Colony, Block A',
      coordinates: { latitude: 28.6339, longitude: 77.2290 },
      city: 'Delhi', state: 'Delhi', pincode: '110003'
    },
    upvotes: 25,
    aiAnalysis: {
      isPothole: false,
      severity: 'high',
      estimatedCost: '₹50,000 - ₹1,00,000',
      confidence: 0.85,
      analyzedAt: new Date()
    }
  },
  {
    title: 'Broken traffic signal at busy intersection',
    description: 'The traffic signal at the main intersection of Ring Road and Highway has been malfunctioning for days. This is causing traffic chaos and increasing accident risk.',
    category: 'traffic_signal',
    severity: 'critical',
    status: 'pending',
    priority: 'urgent',
    location: {
      address: 'Ring Road and Highway Intersection',
      coordinates: { latitude: 28.6439, longitude: 77.2390 },
      city: 'Delhi', state: 'Delhi', pincode: '110004'
    },
    upvotes: 35,
    aiAnalysis: {
      isPothole: false,
      severity: 'critical',
      estimatedCost: '₹75,000 - ₹1,50,000',
      confidence: 0.95,
      analyzedAt: new Date()
    }
  },
  {
    title: 'Blocked drainage causing water logging',
    description: 'The drainage system in our street is completely blocked, causing water to accumulate during rains. This has led to mosquito breeding and health concerns.',
    category: 'drainage',
    severity: 'medium',
    status: 'resolved',
    priority: 'medium',
    location: {
      address: 'Maple Street, Residential Area',
      coordinates: { latitude: 28.6539, longitude: 77.2490 },
      city: 'Delhi', state: 'Delhi', pincode: '110005'
    },
    upvotes: 15,
    aiAnalysis: {
      isPothole: false,
      severity: 'medium',
      estimatedCost: '₹10,000 - ₹20,000',
      confidence: 0.88,
      analyzedAt: new Date()
    },
    resolution: {
      resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      resolution: 'Drainage system cleaned and repaired. Regular maintenance scheduled.',
      cost: 15000,
      duration: 3
    }
  }
];

async function seedDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');

    // Clear existing data
    console.log('🔄 Clearing existing data...');
    await ComplaintHistory.deleteMany({});
    await Complaint.deleteMany({});
    await User.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create users
    console.log('🔄 Creating users...');
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      const savedUser = await user.save();
      createdUsers.push(savedUser);
      console.log(`✅ Created user: ${savedUser.username} (${savedUser.role})`);
    }

    // Create complaints
    console.log('🔄 Creating complaints...');
    const adminUser = createdUsers.find(u => u.role === 'admin');
    const userJohn = createdUsers.find(u => u.username === 'user_john');

    for (let i = 0; i < sampleComplaints.length; i++) {
      const complaintData = sampleComplaints[i];
      const complainant = i < 3 ? userJohn : createdUsers.find(u => u.role === 'user' && u.username !== 'user_john');

      const complaint = new Complaint({
        ...complaintData,
        complainant: complainant._id,
        ...(complaintData.status === 'in_progress' && {
          currentOfficer: adminUser._id,
          currentOffice: adminUser.office
        }),
        ...(complaintData.status === 'resolved' && {
          currentOfficer: adminUser._id,
          currentOffice: adminUser.office
        })
      });

      const savedComplaint = await complaint.save();
      console.log(`✅ Created complaint: ${savedComplaint.complaintId} - ${savedComplaint.title.substring(0, 50)}...`);

      // Create history entries
      const historyEntries = [
        {
          complaintId: savedComplaint.complaintId,
          complaint: savedComplaint._id,
          action: 'submitted',
          previousStatus: 'pending',
          previousOffice: 'Municipal Office',
          newStatus: 'pending',
          newOffice: 'Municipal Office',
          actionBy: complainant._id,
          actionByRole: complainant.role,
          remarks: 'Complaint submitted by user',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
        }
      ];

      if (savedComplaint.status === 'in_progress') {
        historyEntries.push({
          complaintId: savedComplaint.complaintId,
          complaint: savedComplaint._id,
          action: 'status_updated',
          previousStatus: 'pending',
          previousOffice: 'Municipal Office',
          newStatus: 'in_progress',
          newOfficer: savedComplaint.currentOfficer,
          newOffice: savedComplaint.currentOffice,
          actionBy: adminUser._id,
          actionByRole: 'admin',
          remarks: 'Moved to in-progress by admin',
          timestamp: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000) // Random date within last 20 days
        });
      }

      if (savedComplaint.status === 'resolved') {
        historyEntries.push(
          {
            complaintId: savedComplaint.complaintId,
            complaint: savedComplaint._id,
            action: 'status_updated',
            previousStatus: 'pending',
            previousOffice: 'Municipal Office',
            newStatus: 'in_progress',
            newOfficer: adminUser._id,
            newOffice: adminUser.office,
            actionBy: adminUser._id,
            actionByRole: 'admin',
            remarks: 'Moved to in-progress by admin',
            timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
          },
          {
            complaintId: savedComplaint.complaintId,
            complaint: savedComplaint._id,
            action: 'status_updated',
            previousStatus: 'in_progress',
            previousOffice: adminUser.office,
            newStatus: 'resolved',
            newOffice: adminUser.office,
            actionBy: adminUser._id,
            actionByRole: 'admin',
            remarks: savedComplaint.resolution.resolution,
            timestamp: savedComplaint.resolution.resolvedAt
          }
        );
      }

      for (const historyData of historyEntries) {
        const history = new ComplaintHistory(historyData);
        await history.save();
      }
    }

    console.log('🎉 Database seeded successfully!');
    console.log(`📊 Created ${createdUsers.length} users and ${sampleComplaints.length} complaints`);

    // Display summary
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const complaintStats = await Complaint.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\n📈 Database Summary:');
    console.log('Users by role:', userStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}));
    console.log('Complaints by status:', complaintStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}));

    console.log('\n🔑 Test Credentials:');
    console.log('Admin: admin@roadfix.com / admin123');
    console.log('User: john.doe@example.com / user123');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed script
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

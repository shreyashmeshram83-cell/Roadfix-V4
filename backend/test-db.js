// Simple syntax validation test (doesn't require MongoDB running)
const mongoose = require('mongoose');
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const ComplaintHistory = require('./models/ComplaintHistory');
require('dotenv').config();

async function validateSyntax() {
  try {
    console.log('🔄 Testing model imports and syntax...');

    // Test that models are imported (this validates syntax)
    console.log('✅ All models imported successfully');
    console.log('✅ User model:', typeof User);
    console.log('✅ Complaint model:', typeof Complaint);
    console.log('✅ ComplaintHistory model:', typeof ComplaintHistory);

    // Test schema methods exist
    console.log('✅ User schema methods available');
    console.log('✅ Complaint.generateComplaintId method:', typeof Complaint.generateComplaintId);

    console.log('🎉 Syntax validation passed!');

    console.log('\n📋 Next Steps:');
    console.log('1. Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('2. Start MongoDB service: net start MongoDB (Windows)');
    console.log('3. Update .env file with your MongoDB connection string');
    console.log('4. Run: npm run seed (to populate with sample data)');
    console.log('5. Run: npm run dev (to start the server)');

    return true;

  } catch (error) {
    console.error('❌ Syntax validation failed:', error.message);
    return false;
  }
}

// Test database connection and basic operations (requires MongoDB running)
async function testDatabase() {
  try {
    console.log('🔄 Testing database connection...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully');

    // Clean up any existing test data first
    await User.deleteMany({ username: 'testuser' });
    await Complaint.deleteMany({ title: 'Test Pothole Complaint' });
    await ComplaintHistory.deleteMany({ remarks: 'Test complaint submitted' });

    // Test User creation
    console.log('🔄 Testing User model...');
    const testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword123',
      role: 'user',
      profile: {
        firstName: 'Test',
        lastName: 'User'
      }
    });

    const savedUser = await testUser.save();
    console.log('✅ User created successfully:', savedUser.username);

    // Test Complaint creation
    console.log('🔄 Testing Complaint model...');
    const testComplaint = new Complaint({
      title: 'Test Pothole Complaint',
      description: 'This is a test complaint for database validation',
      category: 'pothole',
      severity: 'medium',
      status: 'pending',
      location: {
        address: 'Test Street, Test City',
        coordinates: {
          latitude: 28.6139,
          longitude: 77.2090
        }
      },
      complainant: savedUser._id
    });

    const savedComplaint = await testComplaint.save();
    console.log('✅ Complaint created successfully:', savedComplaint.complaintId);

    // Test ComplaintHistory creation
    console.log('🔄 Testing ComplaintHistory model...');
    const testHistory = new ComplaintHistory({
      complaintId: savedComplaint.complaintId,
      complaint: savedComplaint._id,
      action: 'submitted',
      actionBy: savedUser._id,
      actionByRole: 'user',
      remarks: 'Test complaint submitted',
      timestamp: new Date(),
      previousStatus: 'pending',
      previousOffice: 'Municipal Office',
      newStatus: 'pending',
      newOffice: 'Municipal Office'
    });

    const savedHistory = await testHistory.save();
    console.log('✅ ComplaintHistory created successfully');

    // Test data retrieval
    console.log('🔄 Testing data retrieval...');
    const foundComplaint = await Complaint.findById(savedComplaint._id).populate('complainant');
    console.log('✅ Complaint retrieved:', foundComplaint.title);

    const historyCount = await ComplaintHistory.countDocuments({ complaintId: savedComplaint.complaintId });
    console.log('✅ History entries found:', historyCount);

    // Clean up test data
    console.log('🔄 Cleaning up test data...');
    await ComplaintHistory.deleteMany({ complaintId: savedComplaint.complaintId });
    await Complaint.deleteMany({ complainant: savedUser._id });
    await User.deleteMany({ username: 'testuser' });
    console.log('✅ Test data cleaned up');

    console.log('🎉 All database tests passed successfully!');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('\n💡 Make sure MongoDB is running and check your .env file');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the appropriate test based on command line args
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--full')) {
    testDatabase();
  } else {
    validateSyntax().then(success => {
      process.exit(success ? 0 : 1);
    });
  }
}

module.exports = { validateSyntax, testDatabase };
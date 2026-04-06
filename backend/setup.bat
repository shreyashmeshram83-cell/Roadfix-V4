@echo off
echo 🚀 RoadFix Backend Setup Script
echo ================================

echo.
echo 📦 Installing dependencies...
call npm install

echo.
echo 🔍 Running syntax validation...
call node test-db.js

echo.
echo 📋 Setup Complete!
echo.
echo Next steps:
echo 1. Install MongoDB: https://www.mongodb.com/try/download/community
echo 2. Start MongoDB service: net start MongoDB
echo 3. Update .env file with your MongoDB connection string
echo 4. Run: npm run seed (to populate sample data)
echo 5. Run: npm run dev (to start the development server)
echo.
echo Default login credentials after seeding:
echo Admin: admin@roadfix.com / admin123
echo User: john.doe@example.com / user123
echo.
echo 🌐 API will be available at: http://localhost:5000
echo 📚 API Documentation: Check README.md
echo.
pause

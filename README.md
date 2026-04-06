# RoadFix V4

RoadFix V4 is a full-stack civic reporting platform that allows citizens to report potholes and road damage with photos, live location, and AI validation. It provides a transparent workflow for tracking complaints from submission to resolution.

## Features

- AI-powered pothole/image validation
- Duplicate and spam report detection
- Community feed with upvotes and comments
- Interactive live map of all reports
- Complaint status tracking
- Notifications for updates and resolution
- Admin dashboard for moderation and workflow control
- Repair proof image upload for resolved complaints
- Responsive UI for desktop and mobile

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express
- Database: MongoDB, Mongoose
- Auth: JWT
- File Uploads: Multer
- Maps: MapLibre GL
- AI: Google Gemini
- Security: Helmet, CORS, rate limiting

## Project Structure

- `backend/` - Express API, controllers, models, routes, and services
- `roadfix-india (2)/` - Frontend app, components, utilities, and styles

## Installation

### Prerequisites
- Node.js
- MongoDB
- Git

### Backend Setup
```bash
cd backend
npm install
npm run dev

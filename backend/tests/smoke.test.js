const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

const registerUser = async (overrides = {}) => {
  const baseUser = {
    username: `user_${Math.random().toString(36).slice(2, 8)}`,
    email: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`,
    password: 'test1234'
  };

  const payload = { ...baseUser, ...overrides };
  const response = await request(app).post('/api/auth/register').send(payload);

  return {
    payload,
    response,
    token: response.body.data.token,
    user: response.body.data.user
  };
};

const createAdmin = async () => {
  const admin = await User.create({
    username: `admin_${Math.random().toString(36).slice(2, 8)}`,
    email: `admin_${Date.now()}@example.com`,
    password: 'admin1234',
    role: 'admin',
    office: 'Municipal HQ',
    department: 'Road Maintenance'
  });

  const loginResponse = await request(app).post('/api/auth/login').send({
    email: admin.email,
    password: 'admin1234'
  });

  return {
    admin,
    token: loginResponse.body.data.token
  };
};

describe('RoadFix backend smoke tests', () => {
  test('auth, complaint creation, upvote, notifications, and admin status updates work together', async () => {
    const reporter = await registerUser();
    expect(reporter.response.statusCode).toBe(201);
    expect(reporter.user.role).toBe('user');

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reporter.token}`);

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.body.data.email).toBe(reporter.payload.email);

    const complaintResponse = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${reporter.token}`)
      .field('title', 'Large pothole near bus depot')
      .field('description', 'Deep pothole causing vehicles to swerve near the main bus depot entrance.')
      .field('category', 'pothole')
      .field('severity', 'high')
      .field('location', JSON.stringify({
        address: 'Main Bus Depot, Nagpur',
        coordinates: {
          latitude: 21.1458,
          longitude: 79.0882
        }
      }));

    expect(complaintResponse.statusCode).toBe(201);
    expect(complaintResponse.body.data.location.geo.coordinates).toEqual([79.0882, 21.1458]);

    const complaintId = complaintResponse.body.data._id;

    const initialNotifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${reporter.token}`);

    expect(initialNotifications.statusCode).toBe(200);
    expect(initialNotifications.body.data).toHaveLength(1);
    expect(initialNotifications.body.unreadCount).toBe(1);

    const supporter = await registerUser();
    const upvoteResponse = await request(app)
      .post(`/api/complaints/${complaintId}/upvote`)
      .set('Authorization', `Bearer ${supporter.token}`);

    expect(upvoteResponse.statusCode).toBe(200);
    expect(upvoteResponse.body.data.upvotes).toBe(1);
    expect(upvoteResponse.body.data.hasUpvoted).toBe(true);

    const adminSession = await createAdmin();
    const adminStatusResponse = await request(app)
      .put(`/api/admin/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${adminSession.token}`)
      .send({
        status: 'resolved',
        remarks: 'Repair completed during smoke test'
      });

    expect(adminStatusResponse.statusCode).toBe(200);
    expect(adminStatusResponse.body.data.status).toBe('resolved');
    expect(adminStatusResponse.body.data.resolution.resolution).toBe('Repair completed during smoke test');

    const reporterNotifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${reporter.token}`);

    expect(reporterNotifications.statusCode).toBe(200);
    expect(reporterNotifications.body.data).toHaveLength(3);
    expect(reporterNotifications.body.unreadCount).toBe(3);

    const complaintInDb = await Complaint.findById(complaintId);
    expect(complaintInDb.status).toBe('resolved');
    expect(complaintInDb.upvotes).toBe(1);
  });
});

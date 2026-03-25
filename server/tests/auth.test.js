const request = require('supertest');
const app = require('../index'); // Loads your main server app

describe('Auth API Tests', () => {
  it('should respond to GET / (health check)', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200); // Expect success status
  });

  it('should register a user (mocked)', async () => {
    // Mock database to avoid real DB calls
    jest.mock('../models/User', () => ({
      findOne: jest.fn().mockResolvedValue(null), // No user exists
      create: jest.fn().mockResolvedValue({ username: 'testuser' })
    }));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'password123' });
    expect(res.status).toBe(201); // Expect created status
  });
});
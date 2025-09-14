const request = require('supertest');
const app = require('../app');

describe('HealthWeb Clone API', () => {
  describe('GET /', () => {
    it('should return welcome message', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.body.message).toContain('Hello! Your Node.js app is working!');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.environment).toBeDefined();
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('POST /api/users/register', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(res.body.message).toBe('User created successfully');
      expect(res.body.user.username).toBe(userData.username);
      expect(res.body.user.email).toBe(userData.email);
      expect(res.body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should reject registration with missing fields', async () => {
      const userData = {
        username: 'testuser2'
        // Missing email and password
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(400);

      expect(res.body.error).toBe('Missing required fields');
    });
  });

  describe('POST /api/users/login', () => {
    it('should login with valid credentials', async () => {
      // First register a user
      const userData = {
        username: 'logintest',
        email: 'logintest@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/users/register')
        .send(userData);

      // Then login
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const res = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(200);

      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.email).toBe(userData.email);
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      const res = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(401);

      expect(res.body.error).toBe('Invalid credentials');
    });
  });
});

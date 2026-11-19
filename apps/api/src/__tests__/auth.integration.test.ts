import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { getMockOutbox } from '../services/email.service';
import { resetDatabase } from './setup';

const app = createApp();

describe('Auth API integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns healthy status on GET /api/health and 404 on unknown routes', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const missing = await request(app).get('/api/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
  });

  it('registers customer, blocks login before verification, verifies email, logs in, rotates refresh token and logs out', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      fullName: 'María Cliente',
      email: 'maria@cliente.gt',
      phone: '+502 4444-1111',
      password: 'Password123',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('CUSTOMER');
    expect(reg.body.user.isVerified).toBe(false);

    // Duplicate email rejected
    const dup = await request(app).post('/api/auth/register').send({
      fullName: 'María Cliente',
      email: 'maria@cliente.gt',
      password: 'Password123',
    });
    expect(dup.status).toBe(409);

    // Unverified login rejected
    const unverifiedLogin = await request(app).post('/api/auth/login').send({
      email: 'maria@cliente.gt',
      password: 'Password123',
    });
    expect(unverifiedLogin.status).toBe(401);

    // Resend verification issues a fresh token
    const resend = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'maria@cliente.gt' });
    expect(resend.status).toBe(200);

    const outbox = getMockOutbox();
    const latestEmail = outbox[outbox.length - 1];
    expect(latestEmail.to).toBe('maria@cliente.gt');
    const token = latestEmail.meta?.token;
    expect(token).toBeTruthy();

    // Verify account
    const verify = await request(app).post('/api/auth/verify').send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body.user.isVerified).toBe(true);

    // Reusing verification token fails
    const verifyAgain = await request(app).post('/api/auth/verify').send({ token });
    expect(verifyAgain.status).toBe(400);

    // Resend for verified user is a safe no-op
    const resendVerified = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'maria@cliente.gt' });
    expect(resendVerified.status).toBe(200);

    // Login succeeds and sets httpOnly cookie
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({
      email: 'maria@cliente.gt',
      password: 'Password123',
    });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.permissions).toContain('orders.create');
    const setCookieHeader = login.headers['set-cookie'];
    expect(setCookieHeader?.[0]).toContain('HttpOnly');

    // GET /api/auth/me works with accessToken
    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('maria@cliente.gt');

    // PATCH /api/auth/me updates profile and password
    const badPwdUpdate = await agent
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword1' });
    expect(badPwdUpdate.status).toBe(400);

    const goodUpdate = await agent
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        fullName: 'María Actualizada',
        phone: '+502 5555-9999',
        currentPassword: 'Password123',
        newPassword: 'NewPassword1',
      });
    expect(goodUpdate.status).toBe(200);
    expect(goodUpdate.body.user.fullName).toBe('María Actualizada');

    // Rotate refresh token
    const refreshed = await agent.post('/api/auth/refresh-token');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // Logout revokes cookie session
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    // Subsequent refresh without cookie fails
    const afterLogout = await agent.post('/api/auth/refresh-token');
    expect(afterLogout.status).toBe(401);

    // Login works with new password
    const loginNewPwd = await request(app).post('/api/auth/login').send({
      email: 'maria@cliente.gt',
      password: 'NewPassword1',
    });
    expect(loginNewPwd.status).toBe(200);
  });

  it('handles invitation flow end-to-end and rejects invalid/expired tokens', async () => {
    const adminPassword = await hashPassword('Password123');
    await prisma.user.create({
      data: {
        email: 'admin@artemodelo.gt',
        fullName: 'Admin',
        role: 'ADMIN',
        passwordHash: adminPassword,
        isActive: true,
        isVerified: true,
      },
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@artemodelo.gt',
      password: 'Password123',
    });
    const adminToken = login.body.accessToken as string;

    const invite = await request(app)
      .post('/api/auth/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Carlos Bodega',
        email: 'carlos@artemodelo.gt',
        role: 'EMPLOYEE',
        phone: '+502 5555-2222',
      });
    expect(invite.status).toBe(201);
    expect(invite.body.user.role).toBe('EMPLOYEE');

    const inviteEmail = getMockOutbox().find((m) => m.to === 'carlos@artemodelo.gt');
    const inviteToken = inviteEmail?.meta?.token;
    expect(inviteToken).toBeTruthy();

    // Invalid invitation token fails
    const badComplete = await request(app)
      .post('/api/auth/complete-invitation')
      .send({
        token: 'x'.repeat(32),
        password: 'Password123',
      });
    expect(badComplete.status).toBe(400);

    // Valid completion activates account
    const complete = await request(app)
      .post('/api/auth/complete-invitation')
      .send({
        token: inviteToken,
        fullName: 'Carlos Bodega Jr',
        password: 'Password123',
      });
    expect(complete.status).toBe(200);
    expect(complete.body.user.isVerified).toBe(true);

    // Invited user can login immediately
    const empLogin = await request(app).post('/api/auth/login').send({
      email: 'carlos@artemodelo.gt',
      password: 'Password123',
    });
    expect(empLogin.status).toBe(200);
    expect(empLogin.body.user.role).toBe('EMPLOYEE');
  });

  it('rejects bad credentials, inactive accounts, and malformed payloads', async () => {
    const pwd = await hashPassword('Password123');
    await prisma.user.create({
      data: {
        email: 'inactive@artemodelo.gt',
        fullName: 'Inactivo',
        role: 'CUSTOMER',
        passwordHash: pwd,
        isActive: false,
        isVerified: true,
      },
    });

    const badValidation = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(badValidation.status).toBe(400);

    const wrongPwd = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@artemodelo.gt', password: 'WrongPassword1' });
    expect(wrongPwd.status).toBe(401);

    const inactive = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@artemodelo.gt', password: 'Password123' });
    expect(inactive.status).toBe(401);

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);

    const badBearer = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(badBearer.status).toBe(401);
  });
});

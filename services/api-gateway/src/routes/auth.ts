import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { authenticate } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { body, validationResult } from 'express-validator';
import { generateVerificationCode, generateSecureToken } from '../services/EncryptionService';
import axios from 'axios';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario y tenant
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, tenantName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               tenantName: { type: string }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Email ya registrado
 */
router.post('/register', strictRateLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('tenantName').trim().notEmpty(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', details: errors.array() });
    return;
  }

  const { email, password, name, tenantName } = req.body;

  const existing = await db('users').where({ email }).first();
  if (existing) {
    res.status(409).json({ error: 'EmailConflict', message: 'El email ya está registrado' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const tenantId = uuidv4();
  const userId = uuidv4();
  const tenantSlug = tenantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const verificationCode = generateVerificationCode(6);
  const verificationToken = generateSecureToken();

  await db.transaction(async (trx) => {
    await trx('tenants').insert({
      id: tenantId,
      name: tenantName,
      slug: `${tenantSlug}-${tenantId.slice(0, 8)}`,
      plan: 'FREE',
      is_active: true,
      settings: JSON.stringify({
        allowedSources: ['CHILECOMPRA'],
        maxUsers: 3,
        maxAlerts: 5,
        apiRateLimit: 100,
      }),
    });

    await trx('users').insert({
      id: userId,
      tenant_id: tenantId,
      email,
      name,
      password_hash: passwordHash,
      role: 'ADMIN',
      is_active: true,
      email_verified: false,
      verification_token: verificationToken,
      preferences: JSON.stringify({
        defaultSources: ['CHILECOMPRA'],
        defaultRegions: [],
        emailNotifications: true,
        digestFrequency: 'DAILY',
      }),
    });
  });

  await redis?.setex(`verify:${verificationToken}`, 900, JSON.stringify({ userId, email, code: verificationCode })).catch(() => null);

  await axios.post(`${config.NOTIFICATIONS_SERVICE_URL}/notifications/send`, {
    type: 'EMAIL_VERIFICATION',
    payload: { email, name, code: verificationCode, token: verificationToken },
  }).catch(() => null);

  res.status(201).json({
    message: 'Usuario registrado. Revisa tu email para verificar tu cuenta.',
    userId,
    tenantId,
    emailVerificationRequired: true,
  });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso con tokens JWT
 */
router.post('/login', strictRateLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', details: errors.array() });
    return;
  }

  const { email, password } = req.body;

  const user = await db('users').where({ email, is_active: true }).first();
  if (!user) {
    res.status(401).json({ error: 'InvalidCredentials', message: 'Email o contraseña incorrectos' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    res.status(401).json({ error: 'InvalidCredentials', message: 'Email o contraseña incorrectos' });
    return;
  }

  const payload = {
    sub: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: config.REFRESH_TOKEN_EXPIRES_IN });

  await redis?.setex(`refresh:${user.id}`, 7 * 24 * 3600, refreshToken).catch(() => null);
  await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

  res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id } });
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refrescar access token
 *     security: []
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'MissingToken' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as { sub: string };
    const stored = await redis?.get(`refresh:${decoded.sub}`);
    if (stored !== refreshToken) {
      res.status(401).json({ error: 'InvalidRefreshToken' });
      return;
    }

    const user = await db('users').where({ id: decoded.sub, is_active: true }).first();
    if (!user) {
      res.status(401).json({ error: 'UserNotFound' });
      return;
    }

    const accessToken = jwt.sign(
      { sub: user.id, tenantId: user.tenant_id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'InvalidRefreshToken' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  if (req.user) {
    await redis?.del(`refresh:${req.user.sub}`).catch(() => null);
  }
  res.json({ message: 'Sesión cerrada exitosamente' });
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener perfil del usuario autenticado
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await db('users')
    .select('id', 'email', 'name', 'role', 'tenant_id', 'preferences', 'last_login_at', 'created_at', 'email_verified')
    .where({ id: req.user!.sub })
    .first();

  if (!user) {
    res.status(404).json({ error: 'UserNotFound' });
    return;
  }

  const tenant = await db('tenants').where({ id: user.tenant_id }).first();
  const companyProfile = await db('company_profiles').where({ tenant_id: user.tenant_id }).first().catch(() => null);

  res.json({ ...user, tenant, companyProfile });
});

router.post('/verify-email', async (req: Request, res: Response) => {
  const { token, code } = req.body;
  if (!token) {
    res.status(400).json({ error: 'TokenRequired' });
    return;
  }

  const cached = await redis?.get(`verify:${token}`).catch(() => null);
  if (!cached) {
    res.status(400).json({ error: 'InvalidOrExpiredToken', message: 'El token de verificación ha expirado' });
    return;
  }

  const { userId, code: storedCode } = JSON.parse(cached);

  if (code && code !== storedCode) {
    res.status(400).json({ error: 'InvalidCode', message: 'Código de verificación incorrecto' });
    return;
  }

  await db('users').where({ id: userId }).update({ email_verified: true, verification_token: null, updated_at: new Date() });
  await redis?.del(`verify:${token}`).catch(() => null);

  res.json({ message: 'Email verificado exitosamente' });
});

router.post('/verify-email/resend', strictRateLimiter, authenticate, async (req: Request, res: Response) => {
  const user = await db('users').where({ id: req.user!.sub }).first();
  if (!user || user.email_verified) {
    res.status(400).json({ error: user?.email_verified ? 'AlreadyVerified' : 'UserNotFound' });
    return;
  }

  const code = generateVerificationCode(6);
  const token = generateSecureToken();

  await redis?.setex(`verify:${token}`, 900, JSON.stringify({ userId: user.id, email: user.email, code })).catch(() => null);

  await axios.post(`${config.NOTIFICATIONS_SERVICE_URL}/notifications/send`, {
    type: 'EMAIL_VERIFICATION',
    payload: { email: user.email, name: user.name, code, token },
  }).catch(() => null);

  res.json({ message: 'Código de verificación reenviado' });
});

export default router;

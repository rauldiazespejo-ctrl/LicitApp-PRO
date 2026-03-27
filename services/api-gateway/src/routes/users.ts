import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const users = await db('users')
    .select('id', 'email', 'name', 'role', 'is_active', 'last_login_at', 'created_at')
    .where({ tenant_id: req.tenantId });
  res.json(users);
});

router.patch('/me/preferences', authenticate, async (req: Request, res: Response) => {
  await db('users').where({ id: req.user!.sub }).update({
    preferences: JSON.stringify(req.body.preferences),
    updated_at: new Date(),
  });
  res.json({ message: 'Preferencias actualizadas' });
});

router.patch('/me/password', authenticate, async (req: Request, res: Response) => {
  const bcrypt = await import('bcryptjs');
  const { currentPassword, newPassword } = req.body;

  const user = await db('users').where({ id: req.user!.sub }).first();
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    res.status(400).json({ error: 'InvalidPassword', message: 'Contraseña actual incorrecta' });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db('users').where({ id: req.user!.sub }).update({ password_hash: hash, updated_at: new Date() });
  res.json({ message: 'Contraseña actualizada exitosamente' });
});

export default router;

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const profile = await db('company_profiles')
    .where({ tenant_id: req.tenantId })
    .first();

  if (!profile) {
    res.status(404).json({ error: 'ProfileNotFound' });
    return;
  }
  res.json(profile);
});

router.put('/', authenticate, [
  body('businessName').trim().notEmpty(),
  body('rut').optional().trim(),
  body('industry').optional().trim(),
  body('companySize').optional().isIn(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']),
  body('phone').optional().trim(),
  body('website').optional().isURL(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'ValidationError', details: errors.array() });
    return;
  }

  const { businessName, tradeName, rut, industry, companySize, address, phone, website, description } = req.body;

  const existing = await db('company_profiles').where({ tenant_id: req.tenantId }).first();

  if (existing) {
    await db('company_profiles').where({ tenant_id: req.tenantId }).update({
      business_name: businessName,
      trade_name: tradeName ?? existing.trade_name,
      rut: rut ?? existing.rut,
      industry: industry ?? existing.industry,
      company_size: companySize ?? existing.company_size,
      address: address ?? existing.address,
      phone: phone ?? existing.phone,
      website: website ?? existing.website,
      description: description ?? existing.description,
      updated_at: new Date(),
    });
    const updated = await db('company_profiles').where({ tenant_id: req.tenantId }).first();
    res.json(updated);
  } else {
    const id = uuidv4();
    await db('company_profiles').insert({
      id,
      tenant_id: req.tenantId,
      user_id: req.user!.sub,
      business_name: businessName,
      trade_name: tradeName,
      rut,
      industry,
      company_size: companySize,
      address,
      phone,
      website,
      description,
      is_verified: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const created = await db('company_profiles').where({ id }).first();
    res.status(201).json(created);
  }
});

export default router;

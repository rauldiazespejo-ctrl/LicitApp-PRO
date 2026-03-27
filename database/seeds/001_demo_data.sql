-- Seed: Tenant y usuario de demostración para desarrollo local

INSERT INTO tenants (id, name, slug, plan, is_active, settings) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Demo Company SpA',
   'demo-company-spa-00000001',
   'PROFESSIONAL',
   true,
   '{"allowedSources":["CHILECOMPRA","WHEREX","SAP_ARIBA","SICEP","COUPA","PORTAL_MINERO"],"maxUsers":10,"maxAlerts":50,"apiRateLimit":500}'
  )
ON CONFLICT DO NOTHING;

-- Password: Admin1234! (bcrypt hash)
INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active, preferences) VALUES
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'admin@demo.cl',
   'Administrador Demo',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewxSi7VtFqR.qT1i',
   'ADMIN',
   true,
   '{"defaultSources":["CHILECOMPRA"],"defaultRegions":["Metropolitana"],"emailNotifications":true,"digestFrequency":"DAILY"}'
  )
ON CONFLICT DO NOTHING;

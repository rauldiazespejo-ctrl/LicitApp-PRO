# LicitApp Chile

**Portal Unificado de Licitaciones de Chile**

> Sistema de integracion que consolida en una unica plataforma todas las licitaciones publicas y privadas del mercado chileno, permitiendo a empresas buscar, filtrar y gestionar oportunidades de negocio desde un solo dashboard.

## Funcionalidades

- **6 Portales Integrados**: ChileCompra, Wherex, Portal Minero, SAP Ariba, SICEP, Coupa
- **Búsqueda Full-Text** con Elasticsearch
- **Deduplicación Inteligente** entre fuentes
- **Alertas Personalizadas** por email y push
- **Dashboard Analytics** con evolucion temporal y top compradores
- **Clasificacion UNSPSC** automatica
- **Exportacion** a Excel y PDF
- **SSO por Portal** — login unico por cada conector

## Arquitectura

- Frontend (React 18 + TypeScript + Tailwind CSS)
- API Gateway (Node.js + Express + TypeScript)
- Microservicios: Connectors, Search, Notifications, Export
- PostgreSQL 16 + Redis 7 + Elasticsearch 8.11
- Docker + Kubernetes
- Prometheus + Grafana

## Primeros Pasos

```bash
# Desarrollo local con Docker Compose
cp env.production.example.txt .env.production
python gen_secrets.py
. .\setenv.ps1
docker compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Despliegue produccion
./deploy.sh docker full v1.0.0
```

## Seguridad

- Encriptacion AES-256 en reposo
- TLS 1.3 en transito
- Rate Limiting (100 req/min usuario, 1000 req/min API key)
- Auditoria completa de operaciones
- Sanitizacion de inputs (XSS, SQL injection)
- Headers de seguridad (HSTS, CSP, X-Frame-Options)

## Licencia

MIT

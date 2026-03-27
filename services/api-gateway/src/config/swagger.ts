import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'licitapp Chile API',
      version: '1.0.0',
      description: 'Sistema Unificado de licitapp Chile - API Gateway',
      contact: {
        name: 'Soporte Técnico',
        email: 'api@licitappchile.cl',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autenticación y gestión de sesiones' },
      { name: 'Tenders', description: 'Gestión de licitapp' },
      { name: 'Search', description: 'Búsqueda full-text de licitapp' },
      { name: 'Connectors', description: 'Estado y control de conectores' },
      { name: 'Alerts', description: 'Alertas y notificaciones personalizadas' },
      { name: 'Users', description: 'Gestión de usuarios y perfiles' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { background-color: #1e40af; }',
    customSiteTitle: 'licitapp Chile API Docs',
  }));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  isActive: boolean;
  settings: {
    allowedSources: string[];
    maxUsers: number;
    maxAlerts: number;
    apiRateLimit: number;
  };
  createdAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  preferences: {
    defaultSources: string[];
    defaultRegions: string[];
    emailNotifications: boolean;
    digestFrequency: 'DAILY' | 'WEEKLY' | 'NEVER';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface TenderAlert {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  keywords: string[];
  sources: string[];
  categories: string[];
  regions: string[];
  minBudget?: number;
  maxBudget?: number;
  isActive: boolean;
  notifyViaEmail: boolean;
  notifyViaPush: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
}

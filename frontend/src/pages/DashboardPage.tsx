import { useTenderStats } from '@/hooks/useTenders';
import { useConnectors } from '@/hooks/useConnectors';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileSearch, Plug, TrendingUp, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const SOURCE_COLORS: Record<string, string> = {
  CHILECOMPRA: '#3b82f6',
  WHEREX: '#8b5cf6',
  SAP_ARIBA: '#f59e0b',
  SICEP: '#10b981',
  COUPA: '#ef4444',
  PORTAL_MINERO: '#6b7280',
};

const SOURCE_LABELS: Record<string, string> = {
  CHILECOMPRA: 'ChileCompra',
  WHEREX: 'Wherex',
  SAP_ARIBA: 'SAP Ariba',
  SICEP: 'SICEP',
  COUPA: 'Coupa',
  PORTAL_MINERO: 'Portal Minero',
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useTenderStats();
  const { data: connectors, isLoading: connectorsLoading } = useConnectors();

  const bySourceData = stats?.bySource
    ? Object.entries(stats.bySource as Record<string, number>).map(([key, value]) => ({
        name: SOURCE_LABELS[key] ?? key,
        count: value,
        color: SOURCE_COLORS[key] ?? '#6b7280',
      }))
    : [];

  const byStatusData = stats?.byStatus
    ? Object.entries(stats.byStatus as Record<string, number>).map(([key, value]) => ({
        name: key,
        count: value,
      }))
    : [];

  const activeConnectors = Array.isArray(connectors) ? connectors.filter((c: any) => c.status === 'ACTIVE').length : 0;
  const errorConnectors = Array.isArray(connectors) ? connectors.filter((c: any) => c.status === 'ERROR').length : 0;
  const totalConnectorsCount = Array.isArray(connectors) ? connectors.length : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Resumen del sistema de LicitApp Chile
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Licitaciones"
          value={stats?.total?.toLocaleString('es-CL') ?? '0'}
          icon={<FileSearch className="w-6 h-6 text-purple-600" />}
          bg="bg-purple-50 dark:bg-purple-900/20"
          loading={statsLoading}
        />
        <StatCard
          title="Conectores Activos"
          value={`${activeConnectors} / ${totalConnectorsCount || 6}`}
          icon={<Plug className="w-6 h-6 text-green-600" />}
          bg="bg-green-50 dark:bg-green-900/20"
          loading={connectorsLoading}
        />
        <StatCard
          title="Con Errores"
          value={String(errorConnectors)}
          icon={<AlertCircle className="w-6 h-6 text-red-500" />}
          bg="bg-red-50 dark:bg-red-900/20"
          loading={connectorsLoading}
          accent={errorConnectors > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatCard
          title="Fuentes Integradas"
          value="6"
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
          bg="bg-blue-50 dark:bg-blue-900/20"
          loading={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Licitaciones por Portal
          </h2>
          {statsLoading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySourceData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(v) => [v.toLocaleString('es-CL'), 'Licitaciones']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                  {bySourceData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Distribución por Estado
          </h2>
          {statsLoading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie 
                  data={byStatusData} 
                  dataKey="count" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60}
                  outerRadius={90} 
                  paddingAngle={5}
                >
                  {byStatusData.map((_, i) => (
                    <Cell key={i} fill={['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v.toLocaleString('es-CL'), 'Licitaciones']} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Estado de Conectores
        </h2>
        {connectorsLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.isArray(connectors) ? connectors.map((c: any) => (
              <ConnectorStatusCard key={c.source} connector={c} />
            )) : (
              <p className="text-sm text-gray-500 col-span-full text-center py-4 italic">No hay conectores configurados</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, bg, loading, accent }: {
  title: string; value: string; icon: React.ReactNode; bg: string; loading: boolean; accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          {loading ? (
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-2xl font-bold mt-1 ${accent ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
      </div>
    </div>
  );
}

function ConnectorStatusCard({ connector }: { connector: any }) {
  const isActive = connector.status === 'ACTIVE';
  const isError = connector.status === 'ERROR';
  const labels: Record<string, string> = {
    CHILECOMPRA: 'ChileCompra', WHEREX: 'Wherex', SAP_ARIBA: 'SAP Ariba',
    SICEP: 'SICEP', COUPA: 'Coupa', PORTAL_MINERO: 'Portal Minero',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-yellow-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {labels[connector.source] ?? connector.source}
        </p>
        {connector.lastSync && (
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(connector.lastSync).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      {isActive ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : isError ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : <RefreshCw className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
    </div>
  );
}

function SkeletonChart() {
  return <div className="h-[260px] bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />;
}

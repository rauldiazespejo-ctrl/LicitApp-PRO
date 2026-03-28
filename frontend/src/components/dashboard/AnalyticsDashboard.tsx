import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, AlertTriangle, Building2 } from 'lucide-react';

const PORTAL_COLORS: Record<string, string> = {
  CHILECOMPRA: '#3B82F6',
  WHEREX: '#10B981',
  PORTAL_MINERO: '#F59E0B',
  SAP_ARIBA: '#8B5CF6',
  SICEP: '#EF4444',
  COUPA: '#06B6D4',
};

const UNSPSC_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];

interface SummaryData {
  total: number;
  bySource: { source: string; count: string }[];
  byStatus: { status: string; count: string }[];
  closingSoon: number;
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString('es-CL') : value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { data: summary } = useQuery<SummaryData>({
    queryKey: ['analytics', 'summary'],
    queryFn: () => apiClient.get('/analytics/summary'),
  });

  const { data: temporal = [] } = useQuery<{ period: string; count: string }[]>({
    queryKey: ['analytics', 'temporal'],
    queryFn: () => apiClient.get('/analytics/temporal?granularity=month'),
  });

  const { data: topBuyers = [] } = useQuery<{ buyer_name: string; tender_count: string; total_budget: string }[]>({
    queryKey: ['analytics', 'top-buyers'],
    queryFn: () => apiClient.get('/analytics/top-buyers?limit=10'),
  });

  const { data: unspsc = [] } = useQuery<{ unspsc_code: string; unspsc_label: string; count: string }[]>({
    queryKey: ['analytics', 'unspsc'],
    queryFn: () => apiClient.get('/analytics/unspsc'),
  });

  const { data: closingAlerts = [] } = useQuery<{ id: string; title: string; source: string; closing_date: string }[]>({
    queryKey: ['analytics', 'closing-alerts'],
    queryFn: () => apiClient.get('/analytics/closing-alerts?days=7'),
  });

  const temporalData = temporal.map((d) => ({
    period: new Date(d.period).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
    total: Number(d.count),
  }));

  const sourceData = (summary?.bySource ?? []).map((d) => ({
    name: d.source,
    value: Number(d.count),
    color: PORTAL_COLORS[d.source] ?? '#6B7280',
  }));

  const buyerData = topBuyers.slice(0, 8).map((d) => ({
    name: d.buyer_name?.length > 25 ? d.buyer_name.slice(0, 25) + '…' : (d.buyer_name ?? 'Desconocido'),
    licitapp: Number(d.tender_count),
    presupuesto: Number(d.total_budget),
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total licitapp" value={summary?.total ?? 0} icon={TrendingUp} color="bg-blue-500" />
        <StatCard title="Cierran esta semana" value={summary?.closingSoon ?? 0} icon={AlertTriangle} color="bg-amber-500" />
        <StatCard title="Portales activos" value={sourceData.length} icon={Building2} color="bg-green-500" />
        <StatCard title="Categorías UNSPSC" value={unspsc.length} icon={Users} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolución temporal de publicaciones</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={temporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución por portal</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {sourceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top compradores por volumen</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={buyerData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={180} />
            <Tooltip formatter={(v: number) => v.toLocaleString('es-CL')} />
            <Legend />
            <Bar dataKey="licitapp" fill="#3B82F6" name="licitapp" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución UNSPSC</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unspsc.slice(0, 15).map((item, i) => (
              <div key={item.unspsc_code} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: UNSPSC_COLORS[i % UNSPSC_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate">{item.unspsc_label ?? item.unspsc_code}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{Number(item.count).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (Number(item.count) / Number(unspsc[0]?.count ?? 1)) * 100)}%`,
                        background: UNSPSC_COLORS[i % UNSPSC_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Cierran en los próximos 7 días
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {closingAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin licitapp próximas a cerrar</p>
            ) : (
              closingAlerts.map((a) => {
                const daysLeft = Math.ceil((new Date(a.closing_date).getTime() - Date.now()) / 86400000);
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${daysLeft <= 2 ? 'bg-red-100 text-red-700' : daysLeft <= 4 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {daysLeft}d
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.source}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




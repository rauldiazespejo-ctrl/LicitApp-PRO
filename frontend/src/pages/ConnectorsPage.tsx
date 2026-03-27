import { useConnectors, useSyncJobs } from '@/hooks/useConnectors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { CheckCircle, AlertCircle, RefreshCw, Clock, Loader2, Play } from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  CHILECOMPRA: 'ChileCompra', WHEREX: 'Wherex', SAP_ARIBA: 'SAP Ariba',
  SICEP: 'SICEP', COUPA: 'Coupa', PORTAL_MINERO: 'Portal Minero',
};

export default function ConnectorsPage() {
  const { data: connectors, isLoading } = useConnectors();
  const { data: jobsData } = useSyncJobs({ limit: 20 });
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async ({ source, type }: { source: string; type: 'INCREMENTAL' | 'FULL' }) => {
      const response = await apiClient.post(`/connectors/${source}/sync`, { type });
      return response.data;
    },
    onSuccess: (data, vars) => {
      toast.success(`Sync encolado para ${SOURCE_LABELS[vars.source] ?? vars.source}`);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['sync-jobs'] }), 2000);
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Error al sincronizar'),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conectores</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Estado y control de sincronización de portales
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)
          : (connectors ?? []).map((c: any) => (
              <ConnectorCard
                key={c.source}
                connector={c}
                onSync={(type) => syncMutation.mutate({ source: c.source, type })}
                syncing={syncMutation.isPending && syncMutation.variables?.source === c.source}
              />
            ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Historial de Sincronizaciones
        </h2>
        {!jobsData?.data?.length ? (
          <p className="text-sm text-gray-500 text-center py-8">No hay trabajos de sincronización registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Portal', 'Tipo', 'Estado', 'Registros', 'Duración', 'Fecha'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {jobsData.data.map((job: any) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{SOURCE_LABELS[job.source] ?? job.source}</td>
                    <td className="py-2.5 px-3 text-gray-500">{job.type}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{job.result?.totalFetched ?? '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500">{job.result?.durationMs ? `${(job.result.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500">{new Date(job.created_at ?? job.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorCard({ connector, onSync, syncing }: { connector: any; onSync: (t: 'INCREMENTAL' | 'FULL') => void; syncing: boolean }) {
  const isActive = connector.status === 'ACTIVE';
  const isError = connector.status === 'ERROR';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-yellow-500'}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">{SOURCE_LABELS[connector.source] ?? connector.source}</h3>
        </div>
        {isActive ? <CheckCircle className="w-5 h-5 text-green-500" /> : isError ? <AlertCircle className="w-5 h-5 text-red-500" /> : <RefreshCw className="w-5 h-5 text-yellow-500" />}
      </div>

      <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        {connector.lastSync && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Última sync: {new Date(connector.lastSync).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
        <div>Tasa de éxito: <span className="text-gray-900 dark:text-white font-medium">{((connector.successRate ?? 1) * 100).toFixed(0)}%</span></div>
        <div>Total sincronizado: <span className="text-gray-900 dark:text-white font-medium">{(connector.totalSynced ?? 0).toLocaleString('es-CL')}</span></div>
        {connector.errorMessage && <p className="text-red-500 truncate" title={connector.errorMessage}>{connector.errorMessage}</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSync('INCREMENTAL')}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Sync
        </button>
        <button
          onClick={() => onSync('FULL')}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          Full sync
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    RUNNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>{status}</span>;
}

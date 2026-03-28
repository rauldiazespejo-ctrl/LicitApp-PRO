import { useParams, useNavigate } from 'react-router-dom';
import { useTender } from '@/hooks/useTenders';
import { formatCLP as formatCurrency, formatDate as formatChileanDate } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Calendar, DollarSign, Building2, FileText, Users } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tender, isLoading, isError } = useTender(id!);

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (isError || !tender) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Licitación no encontrada</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline text-sm">Volver</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Volver a licitapp
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{tender.source}</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{tender.status}</span>
              <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">{tender.category}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tender.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: {tender.externalId}</p>
          </div>
        </div>

        {tender.description && (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tender.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Comprador" icon={<Building2 className="w-5 h-5 text-blue-600" />}>
          <p className="font-medium text-gray-900 dark:text-white">{tender.buyer.name}</p>
          {tender.buyer.rut && <p className="text-sm text-gray-500">RUT: {tender.buyer.rut}</p>}
          {tender.buyer.region && <p className="text-sm text-gray-500">{tender.buyer.region}</p>}
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{tender.buyer.type === 'PUBLIC' ? 'Organismo Público' : 'Empresa Privada'}</span>
        </InfoCard>

        <InfoCard title="Presupuesto" icon={<DollarSign className="w-5 h-5 text-green-600" />}>
          {tender.budget ? (
            <>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(tender.budget.amount!)}</p>
              <p className="text-sm text-gray-500">{tender.budget.currency} {tender.budget.isEstimate ? '(estimado)' : ''}</p>
            </>
          ) : <p className="text-gray-500 text-sm">No especificado</p>}
        </InfoCard>

        <InfoCard title="Fechas Clave" icon={<Calendar className="w-5 h-5 text-purple-600" />}>
          <div className="space-y-1 text-sm">
            {tender.publishedAt && <div className="flex justify-between"><span className="text-gray-500">Publicación:</span><span className="font-medium text-gray-900 dark:text-white">{formatChileanDate(tender.publishedAt as unknown as string)}</span></div>}
            {tender.openingDate && <div className="flex justify-between"><span className="text-gray-500">Apertura:</span><span className="font-medium text-gray-900 dark:text-white">{formatChileanDate(tender.openingDate as unknown as string)}</span></div>}
            {tender.closingDate && <div className="flex justify-between"><span className="text-gray-500">Cierre:</span><span className="font-medium text-orange-600 dark:text-orange-400">{formatChileanDate(tender.closingDate as unknown as string)}</span></div>}
            {tender.awardDate && <div className="flex justify-between"><span className="text-gray-500">Adjudicación:</span><span className="font-medium text-gray-900 dark:text-white">{formatChileanDate(tender.awardDate as unknown as string)}</span></div>}
          </div>
        </InfoCard>

        {tender.contacts.length > 0 && (
          <InfoCard title="Contactos" icon={<Users className="w-5 h-5 text-indigo-600" />}>
            {tender.contacts.map((c, i) => (
              <div key={i} className="text-sm space-y-0.5">
                {c.name && <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>}
                {c.email && <p className="text-gray-500">{c.email}</p>}
                {c.phone && <p className="text-gray-500">{c.phone}</p>}
              </div>
            ))}
          </InfoCard>
        )}
      </div>

      {tender.documents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-4">
            <FileText className="w-5 h-5 text-gray-600" />
            Documentos ({tender.documents.length})
          </h2>
          <div className="space-y-2">
            {tender.documents.map((doc) => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{doc.name}</span>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {icon}
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}


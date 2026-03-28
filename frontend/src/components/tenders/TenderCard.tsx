import { useNavigate } from 'react-router-dom';
import { formatCLP as formatCurrency, formatDate as formatChileanDate } from '@/lib/utils';
import { Calendar, DollarSign, Building2, Tag, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  CHILECOMPRA: { label: 'ChileCompra', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  WHEREX: { label: 'Wherex', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  SAP_ARIBA: { label: 'SAP Ariba', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  SICEP: { label: 'SICEP', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  COUPA: { label: 'Coupa', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  PORTAL_MINERO: { label: 'Portal Minero', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Abierta', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  PUBLISHED: { label: 'Publicada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  CLOSED: { label: 'Cerrada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  AWARDED: { label: 'Adjudicada', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  DRAFT: { label: 'Borrador', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  SUSPENDED: { label: 'Suspendida', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

const DEFAULT_BADGE = { label: 'Desconocido', color: 'bg-gray-100 text-gray-600' };

interface Props { tender: any; }

export default function TenderCard({ tender }: Props) {
  const navigate = useNavigate();
  const sourceBadge = SOURCE_BADGE[tender?.source] ?? DEFAULT_BADGE;
  const statusBadge = STATUS_BADGE[tender?.status] ?? DEFAULT_BADGE;

  return (
    <div
      onClick={() => navigate(`/tenders/${tender?.id}`)}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', sourceBadge.color)}>
              {sourceBadge.label}
            </span>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', statusBadge.color)}>
              {statusBadge.label}
            </span>
          </div>

          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
            {tender?.title ?? 'Sin título'}
          </h3>

          {tender?.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
              {tender.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            {tender?.buyer?.name && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {tender.buyer.name}
              </span>
            )}
            {tender?.budget?.amount && (
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                {formatCurrency(tender.budget.amount)}
              </span>
            )}
            {tender?.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatChileanDate(String(tender.publishedAt))}
              </span>
            )}
            {tender?.closingDate && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Cierre: {formatChileanDate(String(tender.closingDate))}
              </span>
            )}
          </div>

          {Array.isArray(tender?.tags) && tender.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {tender.tags.slice(0, 4).map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

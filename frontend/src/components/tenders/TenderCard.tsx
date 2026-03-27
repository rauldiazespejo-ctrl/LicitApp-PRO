import { useNavigate } from 'react-router-dom';
import { Tender, PortalSource, TenderStatus } from '@licitapp/shared';
import { formatCurrency, formatChileanDate, isClosingSoon } from '@licitapp/shared';
import { Calendar, DollarSign, Building2, Tag, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_BADGE: Record<PortalSource, { label: string; color: string }> = {
  [PortalSource.CHILECOMPRA]: { label: 'ChileCompra', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  [PortalSource.WHEREX]: { label: 'Wherex', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  [PortalSource.SAP_ARIBA]: { label: 'SAP Ariba', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  [PortalSource.SICEP]: { label: 'SICEP', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  [PortalSource.COUPA]: { label: 'Coupa', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  [PortalSource.PORTAL_MINERO]: { label: 'Portal Minero', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

const STATUS_BADGE: Record<TenderStatus, { label: string; color: string }> = {
  [TenderStatus.OPEN]: { label: 'Abierta', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  [TenderStatus.PUBLISHED]: { label: 'Publicada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  [TenderStatus.CLOSED]: { label: 'Cerrada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  [TenderStatus.AWARDED]: { label: 'Adjudicada', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  [TenderStatus.CANCELLED]: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  [TenderStatus.DRAFT]: { label: 'Borrador', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  [TenderStatus.SUSPENDED]: { label: 'Suspendida', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

interface Props { tender: Tender; }

export default function TenderCard({ tender }: Props) {
  const navigate = useNavigate();
  const sourceBadge = SOURCE_BADGE[tender.source];
  const statusBadge = STATUS_BADGE[tender.status];
  const closingSoon = tender.closingDate ? isClosingSoon(new Date(tender.closingDate)) : false;

  return (
    <div
      onClick={() => navigate(`/tenders/${tender.id}`)}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600',
        closingSoon
          ? 'border-orange-300 dark:border-orange-600'
          : 'border-gray-200 dark:border-gray-700'
      )}
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
            {closingSoon && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                <Clock className="w-3 h-3" />
                Cierra pronto
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
            {tender.title}
          </h3>

          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {tender.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {tender.buyer.name}
            </span>
            {tender.budget?.amount && (
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                <DollarSign className="w-3.5 h-3.5" />
                {formatCurrency(tender.budget.amount, tender.budget.currency)}
              </span>
            )}
            {tender.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatChileanDate(new Date(tender.publishedAt))}
              </span>
            )}
            {tender.closingDate && (
              <span className={cn('flex items-center gap-1', closingSoon && 'text-orange-600 dark:text-orange-400 font-medium')}>
                <Clock className="w-3.5 h-3.5" />
                Cierre: {formatChileanDate(new Date(tender.closingDate))}
              </span>
            )}
          </div>

          {tender.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {tender.tags.slice(0, 4).map((tag) => (
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

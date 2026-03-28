import { useTenderFilterStore } from '@/stores/tenderFilterStore';
import { X, RotateCcw } from 'lucide-react';

const SOURCES = ['CHILECOMPRA', 'WHEREX', 'SAP_ARIBA', 'SICEP', 'COUPA', 'PORTAL_MINERO'];
const STATUSES = ['PUBLISHED', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED', 'DRAFT', 'SUSPENDED'];
const CATEGORIES = ['CONSTRUCTION', 'TECHNOLOGY', 'SERVICES', 'SUPPLIES', 'HEALTH', 'EDUCATION', 'OTHER'];

const SOURCE_LABELS: Record<string, string> = {
  CHILECOMPRA: 'ChileCompra', WHEREX: 'Wherex', SAP_ARIBA: 'SAP Ariba',
  SICEP: 'SICEP', COUPA: 'Coupa', PORTAL_MINERO: 'Portal Minero',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta', PUBLISHED: 'Publicada', CLOSED: 'Cerrada',
  AWARDED: 'Adjudicada', CANCELLED: 'Cancelada', DRAFT: 'Borrador', SUSPENDED: 'Suspendida',
};

const CATEGORY_LABELS: Record<string, string> = {
  GOODS: 'Bienes', SERVICES: 'Servicios', WORKS: 'Obras',
  CONSULTING: 'Consultoría', TECHNOLOGY: 'Tecnología', MINING: 'Minería',
  ENERGY: 'Energía', OTHER: 'Otro',
};

const REGIONS = [
  'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
  "O'Higgins", 'Maule', 'Biobío', 'Araucanía', 'Los Lagos',
  'Aysén', 'Magallanes', 'Metropolitana', 'Los Ríos', 'Arica y Parinacota', 'Ñuble',
];

interface Props { onClose: () => void; }

export default function TenderFilters({ onClose }: Props) {
  const { filters, updateFilter, resetFilters } = useTenderFilterStore();

  const toggleArray = <T,>(key: keyof typeof filters, val: T) => {
    const current = (filters[key] as T[] | undefined) ?? [];
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    updateFilter(key as any, next.length > 0 ? next as any : undefined);
  };

  const isSelected = <T,>(key: keyof typeof filters, val: T) =>
    ((filters[key] as T[] | undefined) ?? []).includes(val);

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</h3>
        <div className="flex items-center gap-2">
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <RotateCcw className="w-3.5 h-3.5" />
            Limpiar
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <FilterSection title="Portal">
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <FilterChip key={s} label={SOURCE_LABELS[s]} selected={isSelected('sources', s)} onClick={() => toggleArray('sources', s)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Estado">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <FilterChip key={s} label={STATUS_LABELS[s]} selected={isSelected('statuses', s)} onClick={() => toggleArray('statuses', s)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Categoría">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={CATEGORY_LABELS[c]} selected={isSelected('categories', c)} onClick={() => toggleArray('categories', c)} />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Región">
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto scrollbar-thin">
          {REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isSelected('regions', r)}
                onChange={() => toggleArray('regions', r)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {r}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Presupuesto (CLP)">
        <div className="space-y-2">
          <input
            type="number"
            placeholder="Mínimo"
            value={filters.minBudget ?? ''}
            onChange={(e) => updateFilter('minBudget', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="number"
            placeholder="Máximo"
            value={filters.maxBudget ?? ''}
            onChange={(e) => updateFilter('maxBudget', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        selected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}


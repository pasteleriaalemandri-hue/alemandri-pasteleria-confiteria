import { useMemo, useState } from 'react';
import { PackageCheck, Search } from 'lucide-react';
import {
  CLASSIFICATIONS,
  Classification,
  InventoryItem,
  getItemIcon,
} from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  formatNumber,
} from '../utils/formatters';

interface CatalogViewProps {
  inventory: InventoryItem[];
  onGoToNewItem: () => void;
}

type AvailabilityFilter = 'disponibles' | 'todos';

export function CatalogView({
  inventory,
  onGoToNewItem,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<
    'Todas' | Classification
  >('Todas');
  const [availability, setAvailability] =
    useState<AvailabilityFilter>('disponibles');

  const availableCount = useMemo(
    () => inventory.filter((item) => item.currentStock > 0).length,
    [inventory]
  );

  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      if (availability === 'disponibles' && item.currentStock <= 0) {
        return false;
      }
      if (
        selectedClassification !== 'Todas' &&
        item.classification !== selectedClassification
      ) {
        return false;
      }
      if (
        search.trim() &&
        !item.name.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [inventory, availability, selectedClassification, search]);

  return (
    <section className="space-y-6">
      {/* Header & Availability Switch */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14] text-balance">
            Catálogo de Productos e Insumos
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1 tabular-nums">
            {availableCount} disponibles con stock
            <span className="mx-2 text-[#b9a398]" aria-hidden="true">·</span>
            {inventory.length} ítems registrados en Alemandri
          </p>
        </div>

        {/* Availability Segmented Control */}
        <div
          role="group"
          aria-label="Disponibilidad en catálogo"
          className="inline-flex p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8] self-start lg:self-auto"
        >
          <button
            type="button"
            aria-pressed={availability === 'disponibles'}
            onClick={() => setAvailability('disponibles')}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              availability === 'disponibles'
                ? 'bg-[#3b1e14] text-[#fff8f5]'
                : 'text-[#5a3b2e] hover:text-[#3b1e14]'
            }`}
          >
            Solo disponibles
          </button>
          <button
            type="button"
            aria-pressed={availability === 'todos'}
            onClick={() => setAvailability('todos')}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              availability === 'todos'
                ? 'bg-[#3b1e14] text-[#fff8f5]'
                : 'text-[#5a3b2e] hover:text-[#3b1e14]'
            }`}
          >
            Todos los registrados
          </button>
        </div>
      </div>

      {/* Search & Classification Filter Buttons */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[#8c6d62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre (ej. harina, chocolate, caja)..."
              aria-label="Buscar producto o insumo en catálogo"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/20"
            />
          </div>

          <div className="text-xs font-medium text-[#6d4c41] tabular-nums">
            Mostrando {filteredItems.length}{' '}
            {filteredItems.length === 1 ? 'ítem' : 'ítems'}
          </div>
        </div>

        {/* Classification filter buttons/tabs */}
        <div
          role="group"
          aria-label="Filtrar catálogo por clasificación"
          className="flex flex-wrap items-center gap-2 pt-1"
        >
          <button
            type="button"
            aria-pressed={selectedClassification === 'Todas'}
            onClick={() => setSelectedClassification('Todas')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedClassification === 'Todas'
                ? 'bg-[#f462c8] text-[#3b1e14]'
                : 'bg-white border border-[#dccbc2] text-[#5a3b2e] hover:text-[#3b1e14] hover:border-[#b9a398]'
            }`}
          >
            Todas
          </button>
          {CLASSIFICATIONS.map((cat) => {
            const active = selectedClassification === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedClassification(cat)}
                className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#f462c8] text-[#3b1e14]'
                    : 'bg-white border border-[#dccbc2] text-[#5a3b2e] hover:text-[#3b1e14] hover:border-[#b9a398]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Cards Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const icon = getItemIcon(item);
            const hasStock = item.currentStock > 0;

            return (
              <article
                key={item.id}
                className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#d5bfb2] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-2xl bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-3xl shrink-0 select-none"
                  >
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-base text-[#3b1e14] leading-snug">
                      {item.name}
                    </h2>
                    <p className="text-xs text-[#6d4c41] mt-1">
                      {item.classification}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#eadfd8] text-xs">
                  <div>
                    <div className="text-[#6d4c41]">Disponible</div>
                    <div
                      className={`text-sm font-bold tabular-nums mt-0.5 ${
                        hasStock ? 'text-[#3b1e14]' : 'text-[#dc2626]'
                      }`}
                    >
                      {formatNumber(item.currentStock)} {item.defaultUnit}
                    </div>
                  </div>

                  <div>
                    <div className="text-[#6d4c41]">Costo ref.</div>
                    <div className="text-sm font-semibold tabular-nums text-[#3b1e14] mt-0.5">
                      {formatCurrency(item.referenceCost)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[#6d4c41]">Vencimiento</div>
                    <div className="text-xs font-medium tabular-nums text-[#5a3b2e] mt-1">
                      {formatDateDisplay(item.nearestExpiry)}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-10 text-center space-y-3">
          <PackageCheck
            className="w-8 h-8 text-[#8c6d62] mx-auto"
            aria-hidden="true"
          />
          <div className="text-sm font-semibold text-[#3b1e14]">
            No hay ítems que coincidan con tu búsqueda
          </div>
          <p className="text-xs text-[#6d4c41]">
            Prueba limpiando el buscador, cambiando la clasificación o viendo todos los registrados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {(search || selectedClassification !== 'Todas' || availability === 'disponibles') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedClassification('Todas');
                  setAvailability('todos');
                }}
                className="px-4 py-2 min-h-[40px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-xs font-semibold text-[#3b1e14] cursor-pointer"
              >
                Ver todos los registrados
              </button>
            )}
            <button
              type="button"
              onClick={onGoToNewItem}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-xs font-bold text-[#3b1e14] cursor-pointer"
            >
              + Agregar Nuevo Ítem
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

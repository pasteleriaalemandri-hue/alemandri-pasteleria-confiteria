import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  CLASSIFICATIONS,
  Classification,
  InventoryItem,
  MovementType,
  SUPPLY_CLASSIFICATIONS,
  ScopeMode,
  getItemIcon,
  matchesScope,
} from '../types';
import {
  formatCurrency,
  formatDateDisplay,
  formatNumber,
  getDaysUntilExpiry,
} from '../utils/formatters';
import { ScopeLockBar } from './ScopeLockBar';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onQuickMovement: (
    type: MovementType,
    classification: Classification,
    itemId: string
  ) => void;
  onUpdateMinStock: (itemId: string, minStock: number) => void;
  onResetDemo: () => void;
  onGoToNewItem: () => void;
}

type StatusFilter = 'todos' | 'stock-bajo' | 'por-vencer';
type ViewMode = 'cards' | 'list';

const INVENTORY_SCOPE_KEY = 'alemandri_inventory_scope_v1';

function loadInventoryScope(): { scope: ScopeMode; locked: boolean } {
  try {
    const raw = localStorage.getItem(INVENTORY_SCOPE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed?.scope === 'todos' ||
        parsed?.scope === 'insumos' ||
        parsed?.scope === 'producto-final'
      ) {
        return { scope: parsed.scope, locked: Boolean(parsed.locked) };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { scope: 'todos', locked: false };
}

export function InventoryView({
  inventory,
  onQuickMovement,
  onUpdateMinStock,
  onResetDemo,
  onGoToNewItem,
}: InventoryViewProps) {
  const [initialScope] = useState(loadInventoryScope);
  const [scope, setScope] = useState<ScopeMode>(initialScope.scope);
  const [isScopeLocked, setIsScopeLocked] = useState<boolean>(initialScope.locked);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todas' | Classification>(() =>
    initialScope.scope === 'producto-final' ? 'Producto Terminado' : 'Todas'
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        INVENTORY_SCOPE_KEY,
        JSON.stringify({ scope, locked: isScopeLocked })
      );
    } catch {
      // ignore storage errors
    }
  }, [scope, isScopeLocked]);

  const handleScopeChange = (nextScope: ScopeMode) => {
    if (isScopeLocked) return;
    setScope(nextScope);
    if (nextScope === 'producto-final') {
      setCategoryFilter('Producto Terminado');
    } else if (nextScope === 'insumos' && categoryFilter === 'Producto Terminado') {
      setCategoryFilter('Todas');
    } else if (nextScope === 'todos' && categoryFilter === 'Producto Terminado') {
      setCategoryFilter('Todas');
    }
  };

  const allowedClassifications = useMemo(() => {
    if (scope === 'insumos') return SUPPLY_CLASSIFICATIONS;
    if (scope === 'producto-final') return ['Producto Terminado'] as Classification[];
    return [...CLASSIFICATIONS];
  }, [scope]);

  const scopedInventory = useMemo(
    () => inventory.filter((item) => matchesScope(item.classification, scope)),
    [inventory, scope]
  );

  const baseFilteredItems = useMemo(() => {
    return scopedInventory.filter((item) => {
      if (categoryFilter !== 'Todas' && item.classification !== categoryFilter) {
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
  }, [scopedInventory, categoryFilter, search]);

  const statusCounts = useMemo(() => {
    let low = 0;
    let expiring = 0;
    for (const item of baseFilteredItems) {
      if (item.currentStock <= item.minStock) low += 1;
      const days = getDaysUntilExpiry(item.nearestExpiry);
      if (days !== null && days <= 7) expiring += 1;
    }
    return {
      todos: baseFilteredItems.length,
      low,
      expiring,
    };
  }, [baseFilteredItems]);

  const filteredItems = useMemo(() => {
    return baseFilteredItems.filter((item) => {
      if (statusFilter === 'stock-bajo' && item.currentStock > item.minStock) {
        return false;
      }
      if (statusFilter === 'por-vencer') {
        const days = getDaysUntilExpiry(item.nearestExpiry);
        if (days === null || days > 7) return false;
      }
      return true;
    });
  }, [baseFilteredItems, statusFilter]);

  const totalValuation = useMemo(
    () =>
      scopedInventory.reduce(
        (sum, item) => sum + item.currentStock * item.referenceCost,
        0
      ),
    [scopedInventory]
  );

  const scopeSubtitle =
    scope === 'insumos'
      ? 'Insumos en general'
      : scope === 'producto-final'
      ? 'Producto Terminado'
      : 'activos';

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14]">
            Catálogo e Inventario Actual
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1">
            {scopedInventory.length} productos ({scopeSubtitle})
            <span className="mx-2" aria-hidden="true">·</span>
            Valorización estimada:{' '}
            <span className="font-semibold text-[#3b1e14] tabular-nums">
              {formatCurrency(totalValuation)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#dccbc2] bg-[#fff8f5] hover:bg-[#f7eee9] text-[#5a3b2e] text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Restaurar datos iniciales</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetDemo();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#dc2626] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Confirmar restauración
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 min-h-[40px] rounded-xl border border-[#dccbc2] bg-white text-xs font-semibold text-[#3b1e14] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onGoToNewItem}
            className="px-4 py-2 min-h-[40px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-sm font-bold whitespace-nowrap cursor-pointer"
          >
            + Nuevo Ítem
          </button>
        </div>
      </div>

      {/* Lockable Scope Switcher */}
      <ScopeLockBar
        scope={scope}
        isLocked={isScopeLocked}
        onScopeChange={handleScopeChange}
        onToggleLock={() => setIsScopeLocked((prev) => !prev)}
      />

      {/* Filters & View Mode Switcher */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-4 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-4 h-4 text-[#8c6d62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar harina, crema, cajas..."
              aria-label="Buscar producto en inventario"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>

          <select
            aria-label="Filtrar por clasificación"
            disabled={scope === 'producto-final'}
            value={scope === 'producto-final' ? 'Producto Terminado' : categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as 'Todas' | Classification)
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] disabled:bg-[#f7ede7] disabled:text-[#6d4c41] focus:outline-none focus:border-[#f462c8]"
          >
            {scope !== 'producto-final' && (
              <option value="Todas">
                {scope === 'insumos'
                  ? 'Todos los Insumos en general'
                  : 'Todas las clasificaciones'}
              </option>
            )}
            {allowedClassifications.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
          {/* Status segmented filter */}
          <div className="inline-flex p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8]">
            {(
              [
                { id: 'todos', label: `Todos (${statusCounts.todos})` },
                { id: 'stock-bajo', label: `Stock bajo (${statusCounts.low})` },
                { id: 'por-vencer', label: `Por vencer (${statusCounts.expiring})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#3b1e14] text-[#fff8f5]'
                    : 'text-[#5a3b2e] hover:text-[#3b1e14]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* View Mode Selector: Tarjetas Visuales / Vista Lista */}
          <div
            role="group"
            aria-label="Modo de visualización"
            className="inline-flex p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8]"
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[#f462c8] text-[#3b1e14]'
                  : 'text-[#5a3b2e] hover:text-[#3b1e14]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#f462c8] text-[#3b1e14]'
                  : 'text-[#5a3b2e] hover:text-[#3b1e14]'
              }`}
            >
              <List className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Visual Cards Grid (Default) */}
      {viewMode === 'cards' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const icon = getItemIcon(item);
              const isLow = item.currentStock <= item.minStock;
              const daysExp = getDaysUntilExpiry(item.nearestExpiry);
              const isExpiring = daysExp !== null && daysExp <= 7;

              return (
                <article
                  key={item.id}
                  className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#d5bfb2] transition-colors"
                >
                  {/* Header with large visual icon + title */}
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
                      <p className="text-xs text-[#6d4c41] mt-0.5 truncate">
                        {item.classification}
                      </p>

                      {/* State indicators (icon + text, never color alone) */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {isLow && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#dc2626]">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            Stock bajo
                          </span>
                        )}
                        {isExpiring && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#d97706]">
                            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            {daysExp! < 0
                              ? `Venció hace ${Math.abs(daysExp!)}d`
                              : daysExp === 0
                              ? 'Vence hoy'
                              : `Vence en ${daysExp}d`}
                          </span>
                        )}
                        {!isLow && !isExpiring && (
                          <span className="text-[#16a34a] font-medium">
                            Stock óptimo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid (clean unboxed hairline-separated layout) */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 border-t border-[#eadfd8] text-xs">
                    <div>
                      <div className="text-[#6d4c41]">Stock actual</div>
                      <div
                        className={`text-lg font-bold tabular-nums mt-0.5 ${
                          isLow ? 'text-[#dc2626]' : 'text-[#3b1e14]'
                        }`}
                      >
                        {formatNumber(item.currentStock)} {item.defaultUnit}
                      </div>
                    </div>

                    <div>
                      <div className="text-[#6d4c41]">Stock mínimo</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          aria-label={`Stock mínimo de ${item.name}`}
                          value={item.minStock}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (Number.isFinite(val) && val >= 0) {
                              onUpdateMinStock(item.id, val);
                            }
                          }}
                          className="w-20 px-2 py-1 rounded-lg bg-white border border-[#dccbc2] text-sm font-semibold tabular-nums text-[#3b1e14] focus:outline-none focus:border-[#f462c8]"
                        />
                        <span className="text-[#6d4c41]">{item.defaultUnit}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[#6d4c41]">Costo referencial</div>
                      <div className="font-semibold tabular-nums text-[#3b1e14] mt-0.5">
                        {formatCurrency(item.referenceCost)} / {item.defaultUnit}
                      </div>
                    </div>

                    <div>
                      <div className="text-[#6d4c41]">Vencimiento</div>
                      <div className="font-medium tabular-nums text-[#5a3b2e] mt-0.5">
                        {formatDateDisplay(item.nearestExpiry)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onQuickMovement('entrada', item.classification, item.id)
                      }
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>+ Entrada</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickMovement('salida', item.classification, item.id)
                      }
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <ArrowUpFromLine className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>- Salida</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-10 text-center text-sm text-[#6d4c41]">
              No se encontraron productos con los filtros seleccionados.
            </div>
          )}
        </>
      )}

      {/* VIEW 2: Compact List / Table */}
      {viewMode === 'list' && (
        <>
          <div className="hidden md:block bg-[#fff8f5] border border-[#eadfd8] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#eadfd8] bg-[#f7ede7] text-xs font-semibold text-[#5a3b2e]">
                    <th className="py-3 px-4">Producto y Clasificación</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Stock Mín.</th>
                    <th className="py-3 px-4 text-right">Costo Ref.</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eadfd8] text-sm">
                  {filteredItems.map((item) => {
                    const icon = getItemIcon(item);
                    const isLow = item.currentStock <= item.minStock;
                    const daysExp = getDaysUntilExpiry(item.nearestExpiry);
                    const isExpiring = daysExp !== null && daysExp <= 7;
                    return (
                      <tr key={item.id} className="hover:bg-[#fdf3ee] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="w-9 h-9 rounded-xl bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-lg shrink-0"
                            >
                              {icon}
                            </span>
                            <div>
                              <div className="font-semibold text-[#3b1e14]">{item.name}</div>
                              <div className="text-xs text-[#6d4c41]">{item.classification}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#3b1e14]">
                          {formatNumber(item.currentStock)} {item.defaultUnit}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            aria-label={`Stock mínimo de ${item.name}`}
                            value={item.minStock}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (Number.isFinite(val) && val >= 0) {
                                onUpdateMinStock(item.id, val);
                              }
                            }}
                            className="w-20 text-right px-2 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs tabular-nums focus:outline-none focus:border-[#f462c8]"
                          />
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#5a3b2e]">
                          {formatCurrency(item.referenceCost)}
                        </td>
                        <td className="py-3 px-4 text-xs tabular-nums text-[#5a3b2e]">
                          {formatDateDisplay(item.nearestExpiry)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {!isLow && !isExpiring && (
                            <span className="text-[#16a34a] font-medium">Óptimo</span>
                          )}
                          {isLow && (
                            <div className="inline-flex items-center gap-1 text-[#dc2626] font-semibold mr-2">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Stock bajo</span>
                            </div>
                          )}
                          {isExpiring && (
                            <div className="inline-flex items-center gap-1 text-[#d97706] font-semibold">
                              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                {daysExp! < 0
                                  ? 'Vencido'
                                  : daysExp === 0
                                  ? 'Vence hoy'
                                  : `${daysExp}d`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onQuickMovement('entrada', item.classification, item.id)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-xs font-semibold whitespace-nowrap cursor-pointer"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>+ Entrada</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onQuickMovement('salida', item.classification, item.id)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-xs font-semibold whitespace-nowrap cursor-pointer"
                            >
                              <ArrowUpFromLine className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>- Salida</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-[#6d4c41]">
                        No se encontraron productos con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Compact List */}
          <div className="md:hidden bg-[#fff8f5] border border-[#eadfd8] rounded-2xl divide-y divide-[#eadfd8]">
            {filteredItems.map((item) => {
              const icon = getItemIcon(item);
              const isLow = item.currentStock <= item.minStock;
              return (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-10 h-10 rounded-xl bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-xl shrink-0"
                    >
                      {icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#3b1e14] truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-[#6d4c41] tabular-nums">
                        <span className={isLow ? 'text-[#dc2626] font-semibold' : 'font-semibold text-[#3b1e14]'}>
                          {formatNumber(item.currentStock)} {item.defaultUnit}
                        </span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {formatCurrency(item.referenceCost)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onQuickMovement('entrada', item.classification, item.id)
                      }
                      aria-label={`Entrada de ${item.name}`}
                      className="min-h-[40px] px-2.5 rounded-lg bg-[#f462c8] text-[#3b1e14] text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onQuickMovement('salida', item.classification, item.id)
                      }
                      aria-label={`Salida de ${item.name}`}
                      className="min-h-[40px] px-2.5 rounded-lg border border-[#dccbc2] bg-white text-[#3b1e14] text-xs font-bold cursor-pointer"
                    >
                      -
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-sm text-[#6d4c41]">
                No se encontraron productos con los filtros seleccionados.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

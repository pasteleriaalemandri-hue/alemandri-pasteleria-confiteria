import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Clock,
  FileDown,
  Trash2,
} from 'lucide-react';
import {
  CLASSIFICATIONS,
  Classification,
  InventoryItem,
  MovementRecord,
  MovementType,
  PurchaseType,
  SUPPLY_CLASSIFICATIONS,
  ScopeMode,
  matchesScope,
} from '../types';
import { downloadMovementsPdf } from '../utils/pdfExport';
import {
  formatCurrency,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatNumber,
  getDaysUntilExpiry,
  getOffsetDateStr,
  getTodayDateStr,
} from '../utils/formatters';
import { ScopeLockBar } from './ScopeLockBar';

interface DashboardViewProps {
  inventory: InventoryItem[];
  movements: MovementRecord[];
  logoUrl: string;
  onQuickMovement: (
    type: MovementType,
    classification: Classification,
    itemId: string
  ) => void;
  onDeleteMovement: (movementId: string) => void;
  onGoToInventory: () => void;
}

type DatePreset = '7d' | '30d' | 'todo' | 'custom';

const DASHBOARD_SCOPE_KEY = 'alemandri_dashboard_scope_v1';

function loadDashboardScope(): { scope: ScopeMode; locked: boolean } {
  try {
    const raw = localStorage.getItem(DASHBOARD_SCOPE_KEY);
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

export function DashboardView({
  inventory,
  movements,
  logoUrl,
  onQuickMovement,
  onDeleteMovement,
  onGoToInventory,
}: DashboardViewProps) {
  const [initialScope] = useState(loadDashboardScope);
  const [scope, setScope] = useState<ScopeMode>(initialScope.scope);
  const [isScopeLocked, setIsScopeLocked] = useState<boolean>(initialScope.locked);
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [startDate, setStartDate] = useState<string>(() => getOffsetDateStr(-30));
  const [endDate, setEndDate] = useState<string>(() => getTodayDateStr());
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | Classification>(() =>
    initialScope.scope === 'producto-final' ? 'Producto Terminado' : 'Todas'
  );
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<'Todos' | PurchaseType>('Todos');
  const [exportFeedback, setExportFeedback] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_SCOPE_KEY,
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
      setSelectedCategory('Producto Terminado');
    } else if (nextScope === 'insumos' && selectedCategory === 'Producto Terminado') {
      setSelectedCategory('Todas');
    } else if (nextScope === 'todos' && selectedCategory === 'Producto Terminado') {
      setSelectedCategory('Todas');
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

  const scopedMovements = useMemo(
    () => movements.filter((m) => matchesScope(m.classification, scope)),
    [movements, scope]
  );

  const handlePresetClick = (next: DatePreset) => {
    setPreset(next);
    if (next === '7d') {
      setStartDate(getOffsetDateStr(-7));
      setEndDate(getTodayDateStr());
    } else if (next === '30d') {
      setStartDate(getOffsetDateStr(-30));
      setEndDate(getTodayDateStr());
    } else if (next === 'todo') {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredMovements = useMemo(() => {
    return scopedMovements
      .filter((m) => {
        if (selectedCategory !== 'Todas' && m.classification !== selectedCategory) {
          return false;
        }
        if (purchaseTypeFilter !== 'Todos') {
          if (m.type !== 'entrada') return false;
          const pt = m.purchaseType || 'Planificada';
          if (pt !== purchaseTypeFilter) return false;
        }
        const dateOnly = m.dateTime.slice(0, 10);
        if (startDate && dateOnly < startDate) return false;
        if (endDate && dateOnly > endDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
      );
  }, [scopedMovements, selectedCategory, purchaseTypeFilter, startDate, endDate]);

  const metrics = useMemo(() => {
    const entries = filteredMovements.filter((m) => m.type === 'entrada');
    const exits = filteredMovements.filter((m) => m.type === 'salida');

    const totalSpend = entries.reduce((sum, m) => sum + m.totalCost, 0);
    const totalExitsValue = exits.reduce((sum, m) => sum + m.totalCost, 0);

    const plannedEntries = entries.filter(
      (m) => m.purchaseType !== 'Imprevista'
    );
    const unplannedEntries = entries.filter(
      (m) => m.purchaseType === 'Imprevista'
    );

    const plannedSpend = plannedEntries.reduce((sum, m) => sum + m.totalCost, 0);
    const unplannedSpend = unplannedEntries.reduce((sum, m) => sum + m.totalCost, 0);

    const unplannedSpendPct =
      totalSpend > 0 ? (unplannedSpend / totalSpend) * 100 : 0;
    const plannedSpendPct = totalSpend > 0 ? 100 - unplannedSpendPct : 0;

    const byClassification = allowedClassifications.map((cat) => {
      const catSpend = entries
        .filter((m) => m.classification === cat)
        .reduce((s, m) => s + m.totalCost, 0);
      return {
        classification: cat,
        spend: catSpend,
        pct: totalSpend > 0 ? (catSpend / totalSpend) * 100 : 0,
      };
    });

    return {
      totalSpend,
      entryCount: entries.length,
      exitCount: exits.length,
      totalExitsValue,
      plannedCount: plannedEntries.length,
      unplannedCount: unplannedEntries.length,
      plannedSpend,
      unplannedSpend,
      unplannedSpendPct,
      plannedSpendPct,
      byClassification,
    };
  }, [filteredMovements, allowedClassifications]);

  const alerts = useMemo(() => {
    const lowStock = scopedInventory
      .filter((item) => item.currentStock <= item.minStock)
      .sort(
        (a, b) =>
          a.currentStock / Math.max(a.minStock, 1) -
          b.currentStock / Math.max(b.minStock, 1)
      );

    const expiringSoon = scopedInventory
      .map((item) => ({
        item,
        days: getDaysUntilExpiry(item.nearestExpiry),
      }))
      .filter((x): x is { item: InventoryItem; days: number } => x.days !== null && x.days <= 7)
      .sort((a, b) => a.days - b.days);

    return { lowStock, expiringSoon };
  }, [scopedInventory]);

  const handleDownloadPdf = async (period: 'semanal' | 'mensual') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const days = period === 'semanal' ? 7 : 30;
      const count = await downloadMovementsPdf({
        movements: scopedMovements,
        inventory: scopedInventory,
        periodLabel: period,
        daysWindow: days,
        selectedCategory,
        logoUrl,
      });
      setExportFeedback(
        `Reporte ${period} en PDF descargado (${count} movimientos incluidos).`
      );
      window.setTimeout(() => setExportFeedback(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Workspace Header & PDF Reports */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14] text-balance">
            Alemandri — Pastelería y Confitería
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1">
            Control de compras, retiros de producción, alertas y reportes en PDF (Bs.).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleDownloadPdf('semanal')}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] disabled:opacity-60 text-[#fff8f5] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#f462c8] shrink-0" aria-hidden="true" />
            <span>Reporte Semanal (PDF)</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleDownloadPdf('mensual')}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] disabled:opacity-60 text-[#3b1e14] text-sm font-bold whitespace-nowrap transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Reporte Mensual (PDF)</span>
          </button>
        </div>
      </div>

      {exportFeedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#fff8f5] border border-[#f462c8] text-[#3b1e14] text-sm font-medium"
        >
          {exportFeedback}
        </div>
      )}

      {/* Lockable Scope Switcher */}
      <ScopeLockBar
        scope={scope}
        isLocked={isScopeLocked}
        onScopeChange={handleScopeChange}
        onToggleLock={() => setIsScopeLocked((prev) => !prev)}
      />

      {/* Date & Category Filters */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-4 flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5a3b2e] mr-1">
            <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
            Período:
          </span>
          {(
            [
              { id: '7d', label: 'Últimos 7 días' },
              { id: '30d', label: 'Últimos 30 días' },
              { id: 'todo', label: 'Todo el historial' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.id)}
              className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                preset === p.id
                  ? 'bg-[#3b1e14] text-[#fff8f5]'
                  : 'bg-white border border-[#dccbc2] text-[#5a3b2e] hover:text-[#3b1e14]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-start" className="text-xs font-medium text-[#5a3b2e]">
              Desde
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPreset('custom');
                setStartDate(e.target.value);
              }}
              className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white border border-[#dccbc2] text-xs tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-end" className="text-xs font-medium text-[#5a3b2e]">
              Hasta
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setPreset('custom');
                setEndDate(e.target.value);
              }}
              className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white border border-[#dccbc2] text-xs tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>

          <select
            aria-label="Filtrar por clasificación"
            disabled={scope === 'producto-final'}
            value={scope === 'producto-final' ? 'Producto Terminado' : selectedCategory}
            onChange={(e) =>
              setSelectedCategory(e.target.value as 'Todas' | Classification)
            }
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#dccbc2] text-xs font-medium text-[#2b1811] disabled:bg-[#f7ede7] disabled:text-[#6d4c41] focus:outline-none focus:border-[#f462c8]"
          >
            {scope !== 'producto-final' && (
              <option value="Todas">
                {scope === 'insumos'
                  ? 'Todos los Insumos en general'
                  : 'Todas las clasificaciones'}
              </option>
            )}
            {allowedClassifications.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por tipo de compra"
            value={purchaseTypeFilter}
            onChange={(e) =>
              setPurchaseTypeFilter(e.target.value as 'Todos' | PurchaseType)
            }
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#dccbc2] text-xs font-medium text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
          >
            <option value="Todos">Tipo de compra: Todos</option>
            <option value="Planificada">Solo Planificada</option>
            <option value="Imprevista">Solo Imprevista</option>
          </select>
        </div>
      </div>

      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Gasto total en compras
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            {formatCurrency(metrics.totalSpend)}
          </div>
          <div className="mt-3 text-xs text-[#5a3b2e] tabular-nums">
            {metrics.entryCount} entradas registradas
            <span className="mx-1.5 text-[#b9a398]" aria-hidden="true">·</span>
            {selectedCategory !== 'Todas'
              ? selectedCategory
              : scope === 'insumos'
              ? 'Insumos en general'
              : scope === 'producto-final'
              ? 'Producto Terminado'
              : 'Todas las áreas'}
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Compras imprevistas vs. planificadas
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-bold tabular-nums text-[#9d176d]">
              {metrics.unplannedSpendPct.toFixed(1)}%
              <span className="text-xs font-medium text-[#6d4c41] ml-1">imprev.</span>
            </span>
            <span className="text-sm font-semibold tabular-nums text-[#3b1e14]">
              {metrics.plannedSpendPct.toFixed(1)}% planif.
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div
              className="h-2 w-full rounded-full bg-[#e8d9d0] overflow-hidden flex"
              aria-label={`Planificadas ${metrics.plannedSpendPct.toFixed(0)}%, Imprevistas ${metrics.unplannedSpendPct.toFixed(0)}%`}
            >
              <div
                style={{ width: `${metrics.plannedSpendPct}%` }}
                className="bg-[#3b1e14] h-full transition-all duration-300"
              />
              <div
                style={{ width: `${metrics.unplannedSpendPct}%` }}
                className="bg-[#f462c8] h-full transition-all duration-300"
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#5a3b2e] tabular-nums">
              <span>Planif: {formatCurrency(metrics.plannedSpend)} ({metrics.plannedCount})</span>
              <span>Impr: {formatCurrency(metrics.unplannedSpend)} ({metrics.unplannedCount})</span>
            </div>
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Alertas de inventario
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            {alerts.lowStock.length + alerts.expiringSoon.length}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#5a3b2e] tabular-nums">
              {alerts.lowStock.length} stock bajo
              <span className="mx-1.5 text-[#b9a398]" aria-hidden="true">·</span>
              {alerts.expiringSoon.length} por vencer
            </span>
            <button
              type="button"
              onClick={onGoToInventory}
              className="font-semibold text-[#9d176d] hover:underline cursor-pointer"
            >
              Ver todo
            </button>
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Consumo / Retiros (Salida)
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            {formatCurrency(metrics.totalExitsValue)}
          </div>
          <div className="mt-3 text-xs text-[#5a3b2e] tabular-nums">
            {metrics.exitCount} retiros registrados en el período
          </div>
        </article>
      </div>

      {/* Alerts + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#eadfd8]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#3b1e14]">
                Alertas de Stock Bajo
              </h2>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#dc2626]">
              {alerts.lowStock.length} ítems
            </span>
          </div>

          <ul className="divide-y divide-[#eadfd8] mt-2 flex-1">
            {alerts.lowStock.map((item) => (
              <li
                key={item.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#3b1e14] truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-[#6d4c41] tabular-nums mt-0.5">
                    Actual:{' '}
                    <span className="font-semibold text-[#dc2626]">
                      {formatNumber(item.currentStock)} {item.defaultUnit}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    Mín: {formatNumber(item.minStock)} {item.defaultUnit}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onQuickMovement('entrada', item.classification, item.id)
                  }
                  className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Comprar
                </button>
              </li>
            ))}
            {alerts.lowStock.length === 0 && (
              <li className="py-8 text-center text-sm text-[#16a34a] font-medium">
                Todos los ítems están sobre su stock mínimo.
              </li>
            )}
          </ul>
        </div>

        <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#eadfd8]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#d97706] shrink-0" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#3b1e14]">
                Vencimientos Próximos
              </h2>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#d97706]">
              ≤ 7 días
            </span>
          </div>

          <ul className="divide-y divide-[#eadfd8] mt-2 flex-1">
            {alerts.expiringSoon.map(({ item, days }) => (
              <li
                key={item.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#3b1e14] truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-[#6d4c41] tabular-nums mt-0.5">
                    <span
                      className={`font-semibold ${
                        days <= 1 ? 'text-[#dc2626]' : 'text-[#d97706]'
                      }`}
                    >
                      {days < 0
                        ? `Venció hace ${Math.abs(days)}d`
                        : days === 0
                        ? 'Vence hoy'
                        : `Vence en ${days}d`}
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{formatDateDisplay(item.nearestExpiry)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onQuickMovement('salida', item.classification, item.id)
                  }
                  className="px-3 py-1.5 min-h-[36px] rounded-lg border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Retirar
                </button>
              </li>
            ))}
            {alerts.expiringSoon.length === 0 && (
              <li className="py-8 text-center text-sm text-[#16a34a] font-medium">
                Sin productos próximos a vencer en los siguientes 7 días.
              </li>
            )}
          </ul>
        </div>

        <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col">
          <div className="pb-3 border-b border-[#eadfd8]">
            <h2 className="text-base font-bold text-[#3b1e14]">
              Gasto por Clasificación
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5">
              Distribución de compras en Bolivianos (Bs.)
            </p>
          </div>

          <div className="mt-4 space-y-3.5 flex-1">
            {metrics.byClassification.map((row) => (
              <div key={row.classification} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#3b1e14] truncate">
                    {row.classification}
                  </span>
                  <span className="font-semibold tabular-nums text-[#3b1e14] shrink-0">
                    {formatCurrency(row.spend)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#efe5df] overflow-hidden">
                  <div
                    style={{ width: `${Math.max(row.pct, row.spend > 0 ? 4 : 0)}%` }}
                    className="h-full bg-[#f462c8] rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movimientos Recientes */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eadfd8] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#3b1e14]">
              Historial de Movimientos
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5 tabular-nums">
              Mostrando {filteredMovements.length} registros según los filtros activos
            </p>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#eadfd8] bg-[#f7ede7] text-xs font-semibold text-[#5a3b2e]">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Producto y Clasificación</th>
                <th className="py-3 px-4 text-right">Cantidad</th>
                <th className="py-3 px-4">Compra / Motivo</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-right">Costo (Bs.)</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eadfd8] text-sm">
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-[#fdf3ee] transition-colors">
                  <td className="py-3 px-4 text-xs tabular-nums text-[#5a3b2e] whitespace-nowrap">
                    <div>{formatDateTimeDisplay(m.dateTime)}</div>
                    {m.expiryDate && (
                      <div className="text-[11px] text-[#8c6d62]">
                        Vence: {formatDateDisplay(m.expiryDate)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {m.type === 'entrada' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16a34a]">
                        <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9d176d]">
                        <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Salida
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#3b1e14]">{m.itemName}</div>
                    <div className="text-xs text-[#6d4c41]">{m.classification}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#3b1e14] whitespace-nowrap">
                    {m.type === 'entrada' ? '+' : '-'}
                    {formatNumber(m.quantity)} {m.unit}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#5a3b2e]">
                    <div>
                      {m.type === 'entrada' && m.purchaseType && (
                        <span
                          className={`font-semibold ${
                            m.purchaseType === 'Imprevista'
                              ? 'text-[#9d176d]'
                              : 'text-[#3b1e14]'
                          }`}
                        >
                          {m.purchaseType}
                          <span className="mx-1.5 text-[#b9a398]" aria-hidden="true">·</span>
                        </span>
                      )}
                      <span>{m.reason}</span>
                    </div>
                    {m.notes && (
                      <div className="text-[11px] text-[#8c6d62] mt-0.5">
                        {m.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#5a3b2e] whitespace-nowrap">
                    {m.responsible}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#3b1e14] whitespace-nowrap">
                    {formatCurrency(m.totalCost)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteMovement(m.id)}
                      title="Eliminar registro y revertir stock"
                      aria-label={`Eliminar movimiento de ${m.itemName}`}
                      className="p-1.5 rounded-lg text-[#8c6d62] hover:text-[#dc2626] hover:bg-[#fef2f2] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#6d4c41]">
                    No hay movimientos registrados para el rango de fechas o categoría actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-[#eadfd8]">
          {filteredMovements.map((m) => (
            <div key={m.id} className="p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-[#3b1e14]">
                    {m.itemName}
                  </div>
                  <div className="text-xs text-[#6d4c41]">
                    {m.classification}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    {formatDateTimeDisplay(m.dateTime)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      m.type === 'entrada' ? 'text-[#16a34a]' : 'text-[#9d176d]'
                    }`}
                  >
                    {m.type === 'entrada' ? '+' : '-'}
                    {formatNumber(m.quantity)} {m.unit}
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-[#3b1e14]">
                    {formatCurrency(m.totalCost)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-[#5a3b2e]">
                <div className="truncate">
                  {m.type === 'entrada' && m.purchaseType ? `${m.purchaseType} · ` : ''}
                  {m.reason} · {m.responsible}
                  {m.notes ? ` · ${m.notes}` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteMovement(m.id)}
                  aria-label={`Eliminar movimiento de ${m.itemName}`}
                  className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#8c6d62] hover:text-[#dc2626]"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
          {filteredMovements.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6d4c41]">
              No hay movimientos para el período seleccionado.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

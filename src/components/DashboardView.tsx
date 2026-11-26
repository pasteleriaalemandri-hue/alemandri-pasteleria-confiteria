import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  CLASSIFICATIONS,
  Classification,
  InventoryItem,
  MovementRecord,
  MovementType,
  PurchaseType,
  RESPONSIBLES,
  SUPPLY_CLASSIFICATIONS,
  ScopeMode,
  getItemIcon,
  getItemSubdivision,
  matchesScope,
  normalizeResponsibleName,
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
import { DonutChartCard, DonutSlice } from './DonutChartCard';
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
type ProductStatusFilter = 'todos' | 'alertas' | 'optimos';
type HistoryFilterType =
  | 'todos'
  | 'planificada'
  | 'imprevista'
  | 'entrada'
  | 'salida';

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

function PurchaseTypeTag({ purchaseType }: { purchaseType: PurchaseType }) {
  if (purchaseType === 'Imprevista') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fdf0f8] border border-[#f462c8] text-[#9d176d] text-xs font-semibold whitespace-nowrap">
        <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Imprevista</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eef4fb] border border-[#c3d7ee] text-[#1e4976] text-xs font-semibold whitespace-nowrap">
      <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Planificada</span>
    </span>
  );
}

function getInitialDateFilter(): {
  preset: DatePreset;
  start: string;
  end: string;
} {
  const today = getTodayDateStr();
  if (today >= '2026-11-01' && today <= '2026-11-30') {
    return {
      preset: '30d',
      start: getOffsetDateStr(-30),
      end: today,
    };
  }
  return {
    preset: 'todo',
    start: '',
    end: '',
  };
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
  const [initialDates] = useState(getInitialDateFilter);
  const [scope, setScope] = useState<ScopeMode>(initialScope.scope);
  const [isScopeLocked, setIsScopeLocked] = useState<boolean>(initialScope.locked);
  const [preset, setPreset] = useState<DatePreset>(initialDates.preset);
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | Classification>(() =>
    initialScope.scope === 'producto-final' ? 'Producto Terminado' : 'Todas'
  );
  const [stateCategoryFilter, setStateCategoryFilter] = useState<'Todas' | Classification>(() =>
    initialScope.scope === 'producto-final' ? 'Producto Terminado' : 'Todas'
  );
  const [stateSubdivisionFilter, setStateSubdivisionFilter] = useState<string>('Todas');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<'Todos' | PurchaseType>('Todos');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryFilterType>('todos');
  const [historyResponsibleFilter, setHistoryResponsibleFilter] = useState<string>('Todos');
  const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>('todos');
  const [spendDonutMode, setSpendDonutMode] = useState<'categoria' | 'tipo'>('categoria');
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
      setStateCategoryFilter('Producto Terminado');
      setStateSubdivisionFilter('Todas');
    } else if (nextScope === 'insumos') {
      if (selectedCategory === 'Producto Terminado') {
        setSelectedCategory('Todas');
      }
      if (stateCategoryFilter === 'Producto Terminado') {
        setStateCategoryFilter('Todas');
      }
      setStateSubdivisionFilter('Todas');
    } else if (nextScope === 'todos') {
      if (selectedCategory === 'Producto Terminado') {
        setSelectedCategory('Todas');
      }
      if (stateCategoryFilter === 'Producto Terminado') {
        setStateCategoryFilter('Todas');
      }
      setStateSubdivisionFilter('Todas');
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

  const stateClassificationInventory = useMemo(() => {
    if (stateCategoryFilter === 'Todas') return scopedInventory;
    return scopedInventory.filter((item) => item.classification === stateCategoryFilter);
  }, [scopedInventory, stateCategoryFilter]);

  const availableSubdivisions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of stateClassificationInventory) {
      seen.add(getItemSubdivision(item));
    }
    return Array.from(seen);
  }, [stateClassificationInventory]);

  const stateFilteredInventory = useMemo(() => {
    if (stateSubdivisionFilter === 'Todas') return stateClassificationInventory;
    return stateClassificationInventory.filter(
      (item) => getItemSubdivision(item) === stateSubdivisionFilter
    );
  }, [stateClassificationInventory, stateSubdivisionFilter]);

  const inventoryMap = useMemo(
    () => new Map(inventory.map((item) => [item.id, item])),
    [inventory]
  );

  const productStates = useMemo(() => {
    let optimalCount = 0;
    let lowCount = 0;
    let expiringCount = 0;
    let expiringOnlyCount = 0;

    const rows = stateFilteredInventory.map((item) => {
      const isLow = item.currentStock <= item.minStock;
      const daysExp = getDaysUntilExpiry(item.nearestExpiry);
      const isExpiring = daysExp !== null && daysExp <= 7;
      if (isLow) lowCount += 1;
      if (isExpiring) expiringCount += 1;
      if (!isLow && isExpiring) expiringOnlyCount += 1;
      if (!isLow && !isExpiring) optimalCount += 1;
      return { item, isLow, daysExp, isExpiring, subdivision: getItemSubdivision(item) };
    });

    const visibleRows = rows.filter((row) => {
      if (productStatusFilter === 'alertas') return row.isLow || row.isExpiring;
      if (productStatusFilter === 'optimos') return !row.isLow && !row.isExpiring;
      return true;
    });

    return {
      totalCount: rows.length,
      optimalCount,
      lowCount,
      expiringCount,
      expiringOnlyCount,
      visibleRows,
    };
  }, [stateFilteredInventory, productStatusFilter]);

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

  const historyMovements = useMemo(() => {
    return filteredMovements.filter((m) => {
      if (historyResponsibleFilter !== 'Todos') {
        const resp = normalizeResponsibleName(m.responsible);
        if (resp !== historyResponsibleFilter) return false;
      }
      if (historyTypeFilter === 'planificada') {
        return m.type === 'entrada' && (m.purchaseType || 'Planificada') === 'Planificada';
      }
      if (historyTypeFilter === 'imprevista') {
        return m.type === 'entrada' && m.purchaseType === 'Imprevista';
      }
      if (historyTypeFilter === 'entrada') {
        return m.type === 'entrada';
      }
      if (historyTypeFilter === 'salida') {
        return m.type === 'salida';
      }
      return true;
    });
  }, [filteredMovements, historyTypeFilter, historyResponsibleFilter]);

  const historyCounts = useMemo(() => {
    const byResp =
      historyResponsibleFilter === 'Todos'
        ? filteredMovements
        : filteredMovements.filter(
            (m) => normalizeResponsibleName(m.responsible) === historyResponsibleFilter
          );

    return {
      todos: byResp.length,
      planificada: byResp.filter(
        (m) => m.type === 'entrada' && (m.purchaseType || 'Planificada') === 'Planificada'
      ).length,
      imprevista: byResp.filter(
        (m) => m.type === 'entrada' && m.purchaseType === 'Imprevista'
      ).length,
      entrada: byResp.filter((m) => m.type === 'entrada').length,
      salida: byResp.filter((m) => m.type === 'salida').length,
    };
  }, [filteredMovements, historyResponsibleFilter]);

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

  const donutData = useMemo(() => {
    const classificationColors: Record<Classification, string> = {
      'Materia Prima': '#3b1e14',
      'Insumos — Secos': '#8d5524',
      'Insumos — Lácteos y Refrigerados': '#1e4976',
      'Insumos — Decoración y Cacao': '#f462c8',
      Empaque: '#d97706',
      'Producto Terminado': '#9d176d',
    };

    const shortClassLabel: Record<Classification, string> = {
      'Materia Prima': 'Materia Prima',
      'Insumos — Secos': 'Secos',
      'Insumos — Lácteos y Refrigerados': 'Lácteos / Refrig.',
      'Insumos — Decoración y Cacao': 'Decoración y Cacao',
      Empaque: 'Empaque',
      'Producto Terminado': 'Prod. Terminado',
    };

    const statusSlices: DonutSlice[] = [
      {
        id: 'optimo',
        label: 'Óptimo',
        value: productStates.optimalCount,
        color: '#16a34a',
        formattedValue: `${productStates.optimalCount}`,
      },
      {
        id: 'por-vencer',
        label: 'Por vencer (≤7d)',
        value: productStates.expiringOnlyCount,
        color: '#d97706',
        formattedValue: `${productStates.expiringOnlyCount}`,
      },
      {
        id: 'stock-bajo',
        label: 'Stock bajo',
        value: productStates.lowCount,
        color: '#dc2626',
        formattedValue: `${productStates.lowCount}`,
      },
    ];

    const categorySlices: DonutSlice[] = allowedClassifications.map((cat) => {
      const count = scopedInventory.filter(
        (item) => item.classification === cat
      ).length;
      return {
        id: cat,
        label: shortClassLabel[cat],
        value: count,
        color: classificationColors[cat],
        formattedValue: `${count}`,
      };
    });

    const spendCategorySlices: DonutSlice[] = metrics.byClassification.map(
      (row) => ({
        id: row.classification,
        label: shortClassLabel[row.classification],
        value: Number(row.spend.toFixed(2)),
        color: classificationColors[row.classification],
        formattedValue: formatCurrency(row.spend),
      })
    );

    const spendTypeSlices: DonutSlice[] = [
      {
        id: 'planificada',
        label: 'Planificada',
        value: Number(metrics.plannedSpend.toFixed(2)),
        color: '#1e4976',
        formattedValue: formatCurrency(metrics.plannedSpend),
      },
      {
        id: 'imprevista',
        label: 'Imprevista',
        value: Number(metrics.unplannedSpend.toFixed(2)),
        color: '#f462c8',
        formattedValue: formatCurrency(metrics.unplannedSpend),
      },
    ];

    return {
      statusSlices,
      categorySlices,
      spendCategorySlices,
      spendTypeSlices,
    };
  }, [productStates, allowedClassifications, scopedInventory, metrics]);

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
            onChange={(e) => {
              const nextCat = e.target.value as 'Todas' | Classification;
              setSelectedCategory(nextCat);
              setStateCategoryFilter(nextCat);
              setStateSubdivisionFilter('Todas');
            }}
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

      {/* 4-Card KPI Strip (clean spacing, zero overlap/clipping) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-3 min-w-0">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Gasto total en compras
          </div>
          <div className="text-xl sm:text-2xl font-bold leading-tight tabular-nums text-[#3b1e14] break-words">
            {formatCurrency(metrics.totalSpend)}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#5a3b2e] tabular-nums">
            <span>{metrics.entryCount} entradas registradas</span>
            <span className="text-[#b9a398]" aria-hidden="true">·</span>
            <span className="break-words">
              {selectedCategory !== 'Todas'
                ? selectedCategory
                : scope === 'insumos'
                ? 'Insumos en general'
                : scope === 'producto-final'
                ? 'Producto Terminado'
                : 'Todas las áreas'}
            </span>
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-3 min-w-0">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Resumen de compras: Planificada vs. Imprevista
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-xl sm:text-2xl font-bold leading-tight tabular-nums text-[#9d176d]">
              {metrics.unplannedSpendPct.toFixed(1)}%
              <span className="text-xs font-medium text-[#6d4c41] ml-1">imprev.</span>
            </span>
            <span className="text-sm font-semibold tabular-nums text-[#1e4976]">
              {metrics.plannedSpendPct.toFixed(1)}% planif.
            </span>
          </div>
          <div className="space-y-2">
            <div
              className="h-2 w-full rounded-full bg-[#e8d9d0] overflow-hidden flex"
              aria-label={`Planificadas ${metrics.plannedSpendPct.toFixed(0)}%, Imprevistas ${metrics.unplannedSpendPct.toFixed(0)}%`}
            >
              <div
                style={{ width: `${metrics.plannedSpendPct}%` }}
                className="bg-[#1e4976] h-full transition-all duration-300"
              />
              <div
                style={{ width: `${metrics.unplannedSpendPct}%` }}
                className="bg-[#f462c8] h-full transition-all duration-300"
              />
            </div>
            <div className="space-y-1 text-[11px] tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#eef4fb] border border-[#c3d7ee] text-[#1e4976] font-semibold">
                  <CalendarCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Planificada ({metrics.plannedCount})</span>
                </span>
                <span className="font-semibold text-[#3b1e14]">
                  {formatCurrency(metrics.plannedSpend)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#fdf0f8] border border-[#f462c8] text-[#9d176d] font-semibold">
                  <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Imprevista ({metrics.unplannedCount})</span>
                </span>
                <span className="font-semibold text-[#3b1e14]">
                  {formatCurrency(metrics.unplannedSpend)}
                </span>
              </div>
            </div>
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-3 min-w-0">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Alertas de inventario
          </div>
          <div className="text-xl sm:text-2xl font-bold leading-tight tabular-nums text-[#3b1e14]">
            {alerts.lowStock.length + alerts.expiringSoon.length}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#5a3b2e] tabular-nums">
              {alerts.lowStock.length} stock bajo
              <span className="mx-1.5 text-[#b9a398]" aria-hidden="true">·</span>
              {alerts.expiringSoon.length} por vencer
            </span>
            <button
              type="button"
              onClick={onGoToInventory}
              className="font-semibold text-[#9d176d] hover:underline whitespace-nowrap cursor-pointer"
            >
              Ver todo
            </button>
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col justify-between gap-3 min-w-0">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Consumo / Retiros (Salida)
          </div>
          <div className="text-xl sm:text-2xl font-bold leading-tight tabular-nums text-[#3b1e14] break-words">
            {formatCurrency(metrics.totalExitsValue)}
          </div>
          <div className="text-xs text-[#5a3b2e] tabular-nums">
            {metrics.exitCount} retiros registrados en el período
          </div>
        </article>
      </div>

      {/* 3 Interactive Donut Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DonutChartCard
          title="Estado de insumos y productos"
          subtitle="Distribución actual de existencias"
          slices={donutData.statusSlices}
          centerLabel="Productos"
          centerValue={`${productStates.totalCount}`}
          emptyText="No hay ítems en la vista actual."
        />

        <DonutChartCard
          title="Tipo / clasificación de insumos"
          subtitle="Ítems registrados por categoría"
          slices={donutData.categorySlices}
          centerLabel="Catálogo"
          centerValue={`${scopedInventory.length}`}
          emptyText="Sin productos registrados en el alcance actual."
        />

        <DonutChartCard
          title="Asignación de gasto (Bs.)"
          subtitle={
            spendDonutMode === 'categoria'
              ? 'Monto ejecutado por clasificación'
              : 'Compras Planificadas vs. Imprevistas'
          }
          slices={
            spendDonutMode === 'categoria'
              ? donutData.spendCategorySlices
              : donutData.spendTypeSlices
          }
          centerLabel="Total Bs."
          centerValue={formatCurrency(metrics.totalSpend)}
          emptyText="Sin compras registradas en el período."
          headerAction={
            <div
              role="group"
              aria-label="Modo de gráfico de gasto"
              className="inline-flex p-0.5 rounded-lg bg-[#efe5df] border border-[#eadfd8]"
            >
              <button
                type="button"
                onClick={() => setSpendDonutMode('categoria')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  spendDonutMode === 'categoria'
                    ? 'bg-[#3b1e14] text-[#fff8f5]'
                    : 'text-[#5a3b2e] hover:text-[#3b1e14]'
                }`}
              >
                Categoría
              </button>
              <button
                type="button"
                onClick={() => setSpendDonutMode('tipo')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                  spendDonutMode === 'tipo'
                    ? 'bg-[#3b1e14] text-[#fff8f5]'
                    : 'text-[#5a3b2e] hover:text-[#3b1e14]'
                }`}
              >
                Tipo
              </button>
            </div>
          }
        />
      </div>

      {/* SECTION 1: Estado de los productos + Gasto por Clasificación (2 columnas adaptables) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 bg-[#fff8f5] border border-[#eadfd8] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#eadfd8] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f7ede7] border border-[#eadfd8] text-[#3b1e14] flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#3b1e14]">
                    Estado de los productos
                  </h2>
                  <p className="text-xs text-[#6d4c41] mt-0.5 tabular-nums">
                    {productStates.totalCount} visibles · {productStates.optimalCount} óptimos · {productStates.lowCount} stock bajo · {productStates.expiringCount} por vencer
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onGoToInventory}
                className="px-3.5 py-2 min-h-[38px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-xs font-semibold text-[#3b1e14] whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                Ir a Inventario
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrar estado por clasificación"
                disabled={scope === 'producto-final'}
                value={scope === 'producto-final' ? 'Producto Terminado' : stateCategoryFilter}
                onChange={(e) => {
                  setStateCategoryFilter(e.target.value as 'Todas' | Classification);
                  setStateSubdivisionFilter('Todas');
                }}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs font-medium text-[#2b1811] disabled:bg-[#f7ede7] disabled:text-[#6d4c41] focus:outline-none focus:border-[#f462c8]"
              >
                {scope !== 'producto-final' && (
                  <option value="Todas">Clasificación: Todas</option>
                )}
                {allowedClassifications.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar estado por subdivisión"
                value={stateSubdivisionFilter}
                onChange={(e) => setStateSubdivisionFilter(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs font-medium text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              >
                <option value="Todas">Subdivisión: Todas</option>
                {availableSubdivisions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <div
                role="group"
                aria-label="Filtrar estado de los productos"
                className="inline-flex p-0.5 rounded-xl bg-[#efe5df] border border-[#eadfd8] ml-auto"
              >
                {(
                  [
                    { id: 'todos', label: `Todos (${productStates.totalCount})` },
                    {
                      id: 'alertas',
                      label: `Con alerta (${productStates.totalCount - productStates.optimalCount})`,
                    },
                    { id: 'optimos', label: `Óptimos (${productStates.optimalCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setProductStatusFilter(tab.id)}
                    className={`px-2.5 py-1 min-h-[32px] rounded-lg text-xs font-semibold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                      productStatusFilter === tab.id
                        ? 'bg-[#3b1e14] text-[#fff8f5]'
                        : 'text-[#5a3b2e] hover:text-[#3b1e14]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-[#eadfd8] flex-1">
            {productStates.visibleRows.map(({ item, isLow, daysExp, isExpiring, subdivision }) => (
              <div
                key={item.id}
                className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#fdf3ee] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-xl bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-base shrink-0 select-none"
                  >
                    {getItemIcon(item)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#3b1e14] truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-[#6d4c41] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                      <span>{item.classification}</span>
                      <span className="text-[#b9a398]" aria-hidden="true">·</span>
                      <span className="text-[#8c6d62]">{subdivision}</span>
                      <span className="text-[#b9a398]" aria-hidden="true">·</span>
                      <span>
                        Stock:{' '}
                        <strong className={isLow ? 'text-[#dc2626]' : 'text-[#3b1e14]'}>
                          {formatNumber(item.currentStock)} {item.defaultUnit}
                        </strong>
                        {' '}/ Mín: {formatNumber(item.minStock)}
                      </span>
                      {item.nearestExpiry && (
                        <>
                          <span className="text-[#b9a398]" aria-hidden="true">·</span>
                          <span>Vence: {formatDateDisplay(item.nearestExpiry)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                  {isLow && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#dc2626]">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Stock bajo</span>
                    </span>
                  )}
                  {isExpiring && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        daysExp! <= 1 ? 'text-[#dc2626]' : 'text-[#d97706]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {daysExp! < 0
                          ? `Venció hace ${Math.abs(daysExp!)}d`
                          : daysExp === 0
                          ? 'Vence hoy'
                          : `Vence en ${daysExp}d`}
                      </span>
                    </span>
                  )}
                  {!isLow && !isExpiring && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5a3b2e]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#3b1e14]" aria-hidden="true" />
                      <span>Óptimo</span>
                    </span>
                  )}
                </div>
              </div>
            ))}

            {productStates.visibleRows.length === 0 && (
              <div className="py-8 px-4 text-center text-sm text-[#5a3b2e]">
                No hay productos para mostrar con el filtro seleccionado.
              </div>
            )}
          </div>
        </div>

        {/* Category Spend Breakdown (compact side card) */}
        <div className="lg:col-span-4 bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="pb-2.5 border-b border-[#eadfd8] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#3b1e14]">
                  Gasto por Clasificación
                </h2>
                <p className="text-xs text-[#6d4c41] mt-0.5">
                  Compras ejecutadas en Bs.
                </p>
              </div>
              <span className="text-xs font-bold tabular-nums text-[#3b1e14] shrink-0">
                {formatCurrency(metrics.totalSpend)}
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {metrics.byClassification.map((row) => (
                <div key={row.classification} className="space-y-1 min-w-0">
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

          <div className="mt-4 pt-2.5 border-t border-[#eadfd8] flex items-center justify-between text-[11px] text-[#6d4c41] tabular-nums">
            <span>{metrics.entryCount} compras registradas</span>
            <span>100% en Bolivianos</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Alertas de Stock Bajo y Vencimientos Próximos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <li className="py-8 text-center text-sm text-[#5a3b2e] font-medium">
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
                Próximos a vencer
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
              <li className="py-8 text-center text-sm text-[#5a3b2e] font-medium">
                Sin productos próximos a vencer en los siguientes 7 días.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Category Spend Breakdown moved beside Estado de los productos */}

      {/* SECTION 3: Historial de Movimientos */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eadfd8] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#3b1e14]">
                Historial de Movimientos
              </h2>
              <p className="text-xs text-[#6d4c41] mt-0.5 tabular-nums">
                Mostrando {historyMovements.length} registros según los filtros activos
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Filtrar historial por responsable"
                value={historyResponsibleFilter}
                onChange={(e) => setHistoryResponsibleFilter(e.target.value)}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs font-medium text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              >
                <option value="Todos">Responsable: Todos</option>
                {RESPONSIBLES.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>

              {(historyTypeFilter !== 'todos' || historyResponsibleFilter !== 'Todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryTypeFilter('todos');
                    setHistoryResponsibleFilter('Todos');
                  }}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-xs font-semibold text-[#5a3b2e] hover:text-[#3b1e14] whitespace-nowrap cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div
            role="group"
            aria-label="Filtrar historial por tipo de compra o movimiento"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                {
                  id: 'todos',
                  label: 'Todos',
                  count: historyCounts.todos,
                  icon: null,
                  activeClass: 'bg-[#3b1e14] text-[#fff8f5] border-[#3b1e14]',
                },
                {
                  id: 'planificada',
                  label: 'Planificadas',
                  count: historyCounts.planificada,
                  icon: <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
                  activeClass: 'bg-[#1e4976] text-white border-[#1e4976]',
                },
                {
                  id: 'imprevista',
                  label: 'Imprevistas',
                  count: historyCounts.imprevista,
                  icon: <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
                  activeClass: 'bg-[#9d176d] text-white border-[#9d176d]',
                },
                {
                  id: 'entrada',
                  label: 'Entradas',
                  count: historyCounts.entrada,
                  icon: <ArrowDownToLine className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
                  activeClass: 'bg-[#3b1e14] text-[#fff8f5] border-[#3b1e14]',
                },
                {
                  id: 'salida',
                  label: 'Salidas / Retiros',
                  count: historyCounts.salida,
                  icon: <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
                  activeClass: 'bg-[#9d176d] text-white border-[#9d176d]',
                },
              ] as const
            ).map((btn) => {
              const isActive = historyTypeFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setHistoryTypeFilter(btn.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border text-xs font-semibold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? btn.activeClass
                      : 'bg-white border-[#dccbc2] text-[#5a3b2e] hover:text-[#3b1e14] hover:border-[#b9a398]'
                  }`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                  <span
                    className={`text-[11px] ${
                      isActive ? 'opacity-90' : 'text-[#8c6d62]'
                    }`}
                  >
                    ({btn.count})
                  </span>
                </button>
              );
            })}
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
                <th className="py-3 px-4">Tipo de compra</th>
                <th className="py-3 px-4 text-right">Cantidad</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-right">Costo (Bs.)</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eadfd8] text-sm">
              {historyMovements.map((m) => {
                const linkedItem = inventoryMap.get(m.itemId);
                const isAboveMinStock =
                  !!linkedItem && linkedItem.currentStock > linkedItem.minStock;
                const isLowStock =
                  !!linkedItem && linkedItem.currentStock <= linkedItem.minStock;
                const qtyToneClass = isAboveMinStock
                  ? 'text-[#16a34a]'
                  : isLowStock
                  ? 'text-[#dc2626]'
                  : 'text-[#3b1e14]';
                const responsibleName = normalizeResponsibleName(m.responsible);

                return (
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
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3b1e14]">
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
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          aria-hidden="true"
                          className="w-8 h-8 rounded-lg bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-base shrink-0 select-none"
                        >
                          {getItemIcon(
                            linkedItem || {
                              name: m.itemName,
                              classification: m.classification,
                            }
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#3b1e14] truncate">
                            {m.itemName}
                          </div>
                          <div className="text-xs text-[#6d4c41] truncate">
                            {m.classification}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {m.type === 'entrada' ? (
                        <PurchaseTypeTag purchaseType={m.purchaseType || 'Planificada'} />
                      ) : (
                        <span className="text-xs text-[#8c6d62]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <div className={`font-semibold ${qtyToneClass}`}>
                        {m.type === 'entrada' ? '+' : '-'}
                        {formatNumber(m.quantity)} {m.unit}
                      </div>
                      {linkedItem && (
                        <div className={`text-[11px] font-medium ${qtyToneClass}`}>
                          Stock: {formatNumber(linkedItem.currentStock)} {linkedItem.defaultUnit}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5a3b2e]">
                      <div>{m.reason}</div>
                      {m.notes && (
                        <div className="text-[11px] text-[#8c6d62] mt-0.5">
                          {m.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-[#5a3b2e] whitespace-nowrap">
                      {responsibleName}
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
                );
              })}
              {historyMovements.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-[#6d4c41]">
                    No hay movimientos registrados para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-[#eadfd8]">
          {historyMovements.map((m) => {
            const linkedItem = inventoryMap.get(m.itemId);
            const isAboveMinStock =
              !!linkedItem && linkedItem.currentStock > linkedItem.minStock;
            const isLowStock =
              !!linkedItem && linkedItem.currentStock <= linkedItem.minStock;
            const qtyToneClass = isAboveMinStock
              ? 'text-[#16a34a]'
              : isLowStock
              ? 'text-[#dc2626]'
              : 'text-[#3b1e14]';
            const responsibleName = normalizeResponsibleName(m.responsible);

            return (
              <div key={m.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-8 h-8 rounded-lg bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-base shrink-0 select-none mt-0.5"
                    >
                      {getItemIcon(
                        linkedItem || {
                          name: m.itemName,
                          classification: m.classification,
                        }
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-[#3b1e14]">
                        {m.type === 'entrada' ? (
                          <ArrowDownToLine className="w-3.5 h-3.5 text-[#3b1e14] shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowUpFromLine className="w-3.5 h-3.5 text-[#9d176d] shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate">{m.itemName}</span>
                      </div>
                      <div className="text-xs text-[#6d4c41]">
                        {m.classification}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {formatDateTimeDisplay(m.dateTime)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold tabular-nums ${qtyToneClass}`}>
                      {m.type === 'entrada' ? '+' : '-'}
                      {formatNumber(m.quantity)} {m.unit}
                    </div>
                    {linkedItem && (
                      <div className={`text-[11px] font-medium tabular-nums ${qtyToneClass}`}>
                        Stock: {formatNumber(linkedItem.currentStock)} {linkedItem.defaultUnit}
                      </div>
                    )}
                    <div className="text-xs font-semibold tabular-nums text-[#3b1e14]">
                      {formatCurrency(m.totalCost)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-[#5a3b2e]">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {m.type === 'entrada' && (
                      <PurchaseTypeTag purchaseType={m.purchaseType || 'Planificada'} />
                    )}
                    <span className="truncate">
                      {m.reason} · {responsibleName}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteMovement(m.id)}
                    aria-label={`Eliminar movimiento de ${m.itemName}`}
                    className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#8c6d62] hover:text-[#dc2626] shrink-0"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {historyMovements.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6d4c41]">
              No hay movimientos para los filtros seleccionados.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

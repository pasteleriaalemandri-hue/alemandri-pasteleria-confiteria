import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileDown,
  Plus,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  InventoryItem,
  MovementRecord,
  RESPONSIBLES,
  Unit,
  getItemIcon,
} from '../types';
import { downloadFinalProductsPdf } from '../utils/pdfExport';
import {
  formatCurrency,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatNumber,
  getCurrentLocalDateTimeInput,
  getDaysUntilExpiry,
  getOffsetDateStr,
  getTodayDateStr,
} from '../utils/formatters';

interface FinalProductsViewProps {
  inventory: InventoryItem[];
  movements: MovementRecord[];
  logoUrl: string;
  onSubmitMovement: (record: Omit<MovementRecord, 'id'>) => void;
  onAddItem: (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => void;
  onDeleteMovement: (movementId: string) => void;
}

type PdfPeriodPreset = 'hoy' | 'semana' | 'mes' | 'custom';

const FINAL_ICONS = ['🎂', '🍰', '🧁', '🍒', '☕', '🍮', '🍫', '🍓'];

export function FinalProductsView({
  inventory,
  movements,
  logoUrl,
  onSubmitMovement,
  onAddItem,
  onDeleteMovement,
}: FinalProductsViewProps) {
  const finalProducts = useMemo(
    () => inventory.filter((item) => item.classification === 'Producto Terminado'),
    [inventory]
  );

  const todayStr = getTodayDateStr();

  const [historyFilter, setHistoryFilter] = useState<
    'todos' | 'ventas' | 'produccion' | 'hoy'
  >('todos');

  const finalProductMap = useMemo(
    () => new Map(finalProducts.map((it) => [it.id, it])),
    [finalProducts]
  );

  // Today's summary metrics & full Producto Terminado movement history
  const dailySummary = useMemo(() => {
    const allFinalMovs = movements
      .filter((m) => m.classification === 'Producto Terminado')
      .sort(
        (a, b) =>
          new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
      );

    const todayFinalMovs = allFinalMovs.filter(
      (m) => m.dateTime.slice(0, 10) === todayStr
    );

    const producedToday = todayFinalMovs
      .filter((m) => m.type === 'entrada')
      .reduce((sum, m) => sum + m.quantity, 0);

    const soldMovsToday = todayFinalMovs.filter(
      (m) =>
        m.type === 'salida' &&
        m.reason !== 'Merma / producto dañado' &&
        m.reason !== 'Vencimiento / descarte'
    );

    const soldToday = soldMovsToday.reduce((sum, m) => sum + m.quantity, 0);
    const salesRevenueToday = soldMovsToday.reduce(
      (sum, m) => sum + m.totalCost,
      0
    );

    const totalStockUnits = finalProducts.reduce(
      (sum, item) => sum + item.currentStock,
      0
    );

    const visibleMovements = allFinalMovs.filter((m) => {
      if (historyFilter === 'hoy') return m.dateTime.slice(0, 10) === todayStr;
      if (historyFilter === 'ventas') return m.type === 'salida';
      if (historyFilter === 'produccion') return m.type === 'entrada';
      return true;
    });

    return {
      producedToday,
      soldToday,
      salesRevenueToday,
      totalStockUnits,
      todayMovements: todayFinalMovs,
      allFinalMovs,
      visibleMovements,
    };
  }, [movements, finalProducts, todayStr, historyFilter]);

  // Production form state
  const [prodItemId, setProdItemId] = useState<string>(
    () => finalProducts[0]?.id || ''
  );
  const [prodQty, setProdQty] = useState<string>('1');
  const [prodResp, setProdResp] = useState<string>(RESPONSIBLES[0]);
  const [prodDateTime, setProdDateTime] = useState<string>(
    getCurrentLocalDateTimeInput
  );
  const [prodExpiry, setProdExpiry] = useState<string>('');
  const [prodNotes, setProdNotes] = useState<string>('');
  const [prodFeedback, setProdFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // PDF Report period selector state
  const [pdfPreset, setPdfPreset] = useState<PdfPeriodPreset>('hoy');
  const [pdfStartDate, setPdfStartDate] = useState<string>(() => getTodayDateStr());
  const [pdfEndDate, setPdfEndDate] = useState<string>(() => getTodayDateStr());
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<string>('');

  // Sale form state
  const [saleItemId, setSaleItemId] = useState<string>(
    () => finalProducts[0]?.id || ''
  );
  const [saleQty, setSaleQty] = useState<string>('1');
  const [saleResp, setSaleResp] = useState<string>(RESPONSIBLES[4]);
  const [saleDateTime, setSaleDateTime] = useState<string>(
    getCurrentLocalDateTimeInput
  );
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [saleFeedback, setSaleFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // New cake / final product inline drawer state
  const [showNewForm, setShowNewForm] = useState<boolean>(false);
  const [newName, setNewName] = useState('');
  const [newPresentation, setNewPresentation] = useState('');
  const [newIcon, setNewIcon] = useState('🎂');
  const [newUnit, setNewUnit] = useState<Unit>('Unidad');
  const [newPrice, setNewPrice] = useState('');
  const [newInitialStock, setNewInitialStock] = useState('0');
  const [newMinStock, setNewMinStock] = useState('3');
  const [newExpiry, setNewExpiry] = useState('');
  const [newError, setNewError] = useState('');
  const [newSuccess, setNewSuccess] = useState('');

  const prodSectionRef = useRef<HTMLFormElement | null>(null);
  const saleSectionRef = useRef<HTMLFormElement | null>(null);

  const selectedProdItem =
    finalProducts.find((i) => i.id === prodItemId) || finalProducts[0];
  const selectedSaleItem =
    finalProducts.find((i) => i.id === saleItemId) || finalProducts[0];

  const prodQtyNum = parseFloat(prodQty);
  const validProdQty =
    Number.isFinite(prodQtyNum) && prodQtyNum > 0 ? prodQtyNum : 0;

  const saleQtyNum = parseFloat(saleQty);
  const validSaleQty =
    Number.isFinite(saleQtyNum) && saleQtyNum > 0 ? saleQtyNum : 0;
  const saleTotalBs = selectedSaleItem
    ? validSaleQty * selectedSaleItem.referenceCost
    : 0;
  const insufficientStock =
    !!selectedSaleItem && validSaleQty > selectedSaleItem.currentStock;

  const handleProductionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProdFeedback(null);

    if (!selectedProdItem) {
      setProdFeedback({
        ok: false,
        text: 'Agrega primero una torta o producto final.',
      });
      return;
    }

    if (!Number.isFinite(prodQtyNum) || prodQtyNum <= 0) {
      setProdFeedback({
        ok: false,
        text: 'Ingresa una cantidad producida mayor a cero.',
      });
      return;
    }

    onSubmitMovement({
      type: 'entrada',
      classification: 'Producto Terminado',
      itemId: selectedProdItem.id,
      itemName: selectedProdItem.name,
      purchaseType: 'Planificada',
      unit: selectedProdItem.defaultUnit,
      quantity: prodQtyNum,
      totalCost: Number((prodQtyNum * selectedProdItem.referenceCost).toFixed(2)),
      reason: 'Producción interna (Producto Terminado)',
      responsible: prodResp,
      dateTime: prodDateTime || getCurrentLocalDateTimeInput(),
      expiryDate: prodExpiry || undefined,
      notes: prodNotes.trim() || undefined,
    });

    setProdFeedback({
      ok: true,
      text: `Producción sumada: +${formatNumber(prodQtyNum)} ${selectedProdItem.defaultUnit} de ${selectedProdItem.name}${prodExpiry ? ` (vence ${formatDateDisplay(prodExpiry)})` : ''}.`,
    });
    setProdQty('1');
    setProdExpiry('');
    setProdNotes('');
    setProdDateTime(getCurrentLocalDateTimeInput());
  };

  const handleSelectPdfPreset = (next: PdfPeriodPreset) => {
    setPdfPreset(next);
    const today = getTodayDateStr();
    if (next === 'hoy') {
      setPdfStartDate(today);
      setPdfEndDate(today);
    } else if (next === 'semana') {
      setPdfStartDate(getOffsetDateStr(-7));
      setPdfEndDate(today);
    } else if (next === 'mes') {
      setPdfStartDate(getOffsetDateStr(-30));
      setPdfEndDate(today);
    }
  };

  const handleExportFinalPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const labelMap: Record<PdfPeriodPreset, string> = {
        hoy: 'Hoy',
        semana: 'Esta semana',
        mes: 'Este mes',
        custom: 'Rango personalizado',
      };
      const count = await downloadFinalProductsPdf({
        movements,
        inventory,
        periodLabel: labelMap[pdfPreset],
        startDate: pdfStartDate,
        endDate: pdfEndDate,
        logoUrl,
      });
      setPdfNotice(
        `Reporte PDF de Tortas / Producto Final descargado (${count} movimientos en el período).`
      );
      window.setTimeout(() => setPdfNotice(''), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaleFeedback(null);

    if (!selectedSaleItem) {
      setSaleFeedback({
        ok: false,
        text: 'Selecciona una torta o producto final.',
      });
      return;
    }

    if (!Number.isFinite(saleQtyNum) || saleQtyNum <= 0) {
      setSaleFeedback({
        ok: false,
        text: 'Ingresa una cantidad vendida mayor a cero.',
      });
      return;
    }

    if (saleQtyNum > selectedSaleItem.currentStock) {
      setSaleFeedback({
        ok: false,
        text: `Stock insuficiente en vitrina (${formatNumber(selectedSaleItem.currentStock)} ${selectedSaleItem.defaultUnit} disponibles).`,
      });
      return;
    }

    const totalBs = Number(
      (saleQtyNum * selectedSaleItem.referenceCost).toFixed(2)
    );

    onSubmitMovement({
      type: 'salida',
      classification: 'Producto Terminado',
      itemId: selectedSaleItem.id,
      itemName: selectedSaleItem.name,
      unit: selectedSaleItem.defaultUnit,
      quantity: saleQtyNum,
      totalCost: totalBs,
      reason: 'Venta / despacho',
      responsible: saleResp,
      dateTime: saleDateTime || getCurrentLocalDateTimeInput(),
      notes: saleNotes.trim() || undefined,
    });

    setSaleFeedback({
      ok: true,
      text: `Venta registrada: ${formatNumber(saleQtyNum)} ${selectedSaleItem.defaultUnit} de ${selectedSaleItem.name} (${formatCurrency(totalBs)}).`,
    });
    setSaleQty('1');
    setSaleNotes('');
    setSaleDateTime(getCurrentLocalDateTimeInput());
  };

  const handleCreateCake = (e: React.FormEvent) => {
    e.preventDefault();
    setNewError('');
    setNewSuccess('');

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNewError('Ingresa el nombre de la torta o producto final.');
      return;
    }

    const duplicate = inventory.some(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setNewError(`Ya existe "${trimmedName}" en el catálogo.`);
      return;
    }

    const parsedPrice = parseFloat(newPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setNewError('Ingresa un precio de venta válido en Bs.');
      return;
    }

    const parsedInitial = parseFloat(newInitialStock || '0');
    if (!Number.isFinite(parsedInitial) || parsedInitial < 0) {
      setNewError('El stock inicial no puede ser negativo.');
      return;
    }

    const parsedMin = parseFloat(newMinStock || '0');
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      setNewError('El stock mínimo no puede ser negativo.');
      return;
    }

    onAddItem({
      name: trimmedName,
      classification: 'Producto Terminado',
      presentation: newPresentation.trim() || undefined,
      defaultUnit: newUnit,
      currentStock: parsedInitial,
      minStock: parsedMin,
      referenceCost: parsedPrice,
      icon: newIcon,
      nearestExpiry: newExpiry || undefined,
    });

    setNewSuccess(
      `${newIcon} "${trimmedName}" se agregó al catálogo de Producto Terminado.`
    );
    setNewName('');
    setNewPresentation('');
    setNewPrice('');
    setNewInitialStock('0');
    setNewMinStock('3');
    setNewExpiry('');
    setShowNewForm(false);
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14] text-balance">
            Producto Final — Tortas y Vitrina
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1">
            Control diario de producción, ventas en vitrina, precios en Bs. y sincronización automática.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleExportFinalPdf}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] disabled:opacity-60 text-[#fff8f5] text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#f462c8] shrink-0" aria-hidden="true" />
            <span>Reporte Tortas / Producto Final (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNewForm((prev) => !prev);
              setNewError('');
              setNewSuccess('');
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-sm font-bold whitespace-nowrap transition-colors cursor-pointer"
          >
            {showNewForm ? (
              <>
                <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Cerrar formulario</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Nueva torta / producto final</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Period selector bar for Producto Final PDF Report */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-3.5 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5a3b2e] mr-1">
            <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
            Período del reporte PDF:
          </span>
          {(
            [
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Esta semana' },
              { id: 'mes', label: 'Este mes' },
              { id: 'custom', label: 'Rango de fechas' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPdfPreset(p.id)}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                pdfPreset === p.id
                  ? 'bg-[#3b1e14] text-[#fff8f5]'
                  : 'bg-white border border-[#dccbc2] text-[#5a3b2e] hover:text-[#3b1e14]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="pdf-final-start" className="text-xs font-medium text-[#5a3b2e]">
              Desde
            </label>
            <input
              id="pdf-final-start"
              type="date"
              value={pdfStartDate}
              onChange={(e) => {
                setPdfPreset('custom');
                setPdfStartDate(e.target.value);
              }}
              className="min-h-[38px] px-2.5 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="pdf-final-end" className="text-xs font-medium text-[#5a3b2e]">
              Hasta
            </label>
            <input
              id="pdf-final-end"
              type="date"
              value={pdfEndDate}
              onChange={(e) => {
                setPdfPreset('custom');
                setPdfEndDate(e.target.value);
              }}
              className="min-h-[38px] px-2.5 py-1 rounded-lg bg-white border border-[#dccbc2] text-xs tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>
        </div>
      </div>

      {pdfNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-[#fff8f5] border border-[#f462c8] text-[#3b1e14] text-sm font-medium"
        >
          {pdfNotice}
        </div>
      )}

      {newSuccess && (
        <div
          role="status"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#eef8f1] border border-[#b9dfc5] text-[#14532d] text-sm font-medium"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16a34a]" aria-hidden="true" />
          <span>{newSuccess}</span>
        </div>
      )}

      {/* Inline New Cake / Final Product Form */}
      {showNewForm && (
        <form
          onSubmit={handleCreateCake}
          className="bg-[#fff8f5] border border-[#f462c8] rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#eadfd8] pb-3">
            <h2 className="text-base font-bold text-[#3b1e14]">
              Registrar nueva torta o producto terminado
            </h2>
          </div>

          {newError && (
            <div
              role="alert"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              <span>{newError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="cake-name"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Nombre del producto
              </label>
              <input
                id="cake-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Torta Selva Negra"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="cake-presentation"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Tamaño / presentación
              </label>
              <input
                id="cake-presentation"
                type="text"
                value={newPresentation}
                onChange={(e) => setNewPresentation(e.target.value)}
                placeholder="Ej. Entera 26cm / Porción"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="cake-price"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Precio de venta (Bs.)
              </label>
              <input
                id="cake-price"
                type="number"
                step="0.01"
                min="0"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="160.00"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="cake-unit"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Unidad
              </label>
              <select
                id="cake-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as Unit)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              >
                <option value="Unidad">Unidad</option>
                <option value="Caja">Caja</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="cake-initial"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Stock inicial
              </label>
              <input
                id="cake-initial"
                type="number"
                step="1"
                min="0"
                value={newInitialStock}
                onChange={(e) => setNewInitialStock(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="cake-min"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Stock mínimo
              </label>
              <input
                id="cake-min"
                type="number"
                step="1"
                min="0"
                value={newMinStock}
                onChange={(e) => setNewMinStock(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="cake-expiry"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Fecha de vencimiento <span className="font-normal text-[#6d4c41]">(opcional)</span>
              </label>
              <input
                id="cake-expiry"
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div className="sm:col-span-2">
              <span className="block text-sm font-semibold text-[#3b1e14] mb-1.5">
                Ícono
              </span>
              <div className="flex flex-wrap gap-2">
                {FINAL_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewIcon(emoji)}
                    className={`min-w-[44px] min-h-[44px] rounded-xl text-2xl flex items-center justify-center transition-all cursor-pointer ${
                      newIcon === emoji
                        ? 'bg-[#fdf0f8] border-2 border-[#f462c8] scale-105'
                        : 'bg-white border border-[#dccbc2] hover:border-[#b9a398]'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 min-h-[44px] rounded-xl border border-[#dccbc2] bg-white text-sm font-semibold text-[#3b1e14] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] text-[#fff8f5] text-sm font-bold cursor-pointer"
            >
              Guardar en Producto Terminado
            </button>
          </div>
        </form>
      )}

      {/* Resumen del día (4 KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Unidades producidas hoy
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            +{formatNumber(dailySummary.producedToday)}
          </div>
          <div className="mt-2 text-xs text-[#5a3b2e]">
            Ingresos de producción del día
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Unidades vendidas hoy
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#9d176d]">
            {formatNumber(dailySummary.soldToday)}
          </div>
          <div className="mt-2 text-xs text-[#5a3b2e]">
            Despachos y ventas en vitrina
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Ingreso estimado ventas hoy
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            {formatCurrency(dailySummary.salesRevenueToday)}
          </div>
          <div className="mt-2 text-xs text-[#5a3b2e]">
            Calculado según precio de venta
          </div>
        </article>

        <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5">
          <div className="text-xs font-semibold text-[#6d4c41]">
            Total unidades en stock
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#3b1e14]">
            {formatNumber(dailySummary.totalStockUnits)}
          </div>
          <div className="mt-2 text-xs text-[#5a3b2e] tabular-nums">
            En {finalProducts.length} variedades de producto final
          </div>
        </article>
      </div>

      {/* Registro rápido diario: Producción (+ Stock) y Venta (- Stock) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Producción del día (+ Stock) */}
        <form
          ref={prodSectionRef}
          onSubmit={handleProductionSubmit}
          className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#eadfd8]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#3b1e14] text-[#f462c8] flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#3b1e14]">
                  Producción del día (+ Stock)
                </h2>
                <p className="text-xs text-[#6d4c41]">
                  Suma unidades terminadas al stock de vitrina
                </p>
              </div>
            </div>
          </div>

          {prodFeedback && (
            <div
              role="status"
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                prodFeedback.ok
                  ? 'bg-[#eef8f1] border-[#b9dfc5] text-[#14532d]'
                  : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              }`}
            >
              {prodFeedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16a34a]" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              )}
              <span>{prodFeedback.text}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="prod-cake-select"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Torta / producto final
            </label>
            <select
              id="prod-cake-select"
              value={selectedProdItem?.id || ''}
              onChange={(e) => setProdItemId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            >
              {finalProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {getItemIcon(item)} {item.name}
                  {item.presentation ? ` (${item.presentation})` : ''} — Stock:{' '}
                  {formatNumber(item.currentStock)} {item.defaultUnit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="prod-qty"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Cantidad producida ({selectedProdItem?.defaultUnit || 'Unidad'})
              </label>
              <input
                id="prod-qty"
                type="number"
                step="1"
                min="1"
                required
                value={prodQty}
                onChange={(e) => setProdQty(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="prod-resp"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Responsable
              </label>
              <select
                id="prod-resp"
                value={prodResp}
                onChange={(e) => setProdResp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              >
                {RESPONSIBLES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="prod-dt"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Fecha y hora
              </label>
              <input
                id="prod-dt"
                type="datetime-local"
                required
                value={prodDateTime}
                onChange={(e) => setProdDateTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="prod-expiry"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Fecha de vencimiento del lote <span className="font-normal text-[#6d4c41]">(opcional)</span>
              </label>
              <input
                id="prod-expiry"
                type="date"
                value={prodExpiry}
                onChange={(e) => setProdExpiry(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="prod-notes"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Observación <span className="font-normal text-[#6d4c41]">(opcional)</span>
            </label>
            <input
              id="prod-notes"
              type="text"
              maxLength={100}
              value={prodNotes}
              onChange={(e) => setProdNotes(e.target.value)}
              placeholder="Ej. Lote mañana"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            />
          </div>

          {selectedProdItem && (
            <div className="pt-2 border-t border-[#eadfd8] flex items-center justify-between text-xs text-[#5a3b2e] tabular-nums">
              <span>
                Stock actual: {formatNumber(selectedProdItem.currentStock)}{' '}
                {selectedProdItem.defaultUnit}
              </span>
              <span className="font-bold text-[#16a34a]">
                Nuevo stock:{' '}
                {formatNumber(selectedProdItem.currentStock + validProdQty)}{' '}
                {selectedProdItem.defaultUnit}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={finalProducts.length === 0}
            className="w-full min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] disabled:opacity-50 text-[#fff8f5] text-sm font-bold transition-colors cursor-pointer"
          >
            Registrar Producción (+ Stock)
          </button>
        </form>

        {/* Form 2: Venta / Salida (- Stock) */}
        <form
          ref={saleSectionRef}
          onSubmit={handleSaleSubmit}
          className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#eadfd8]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#f462c8] text-[#3b1e14] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#3b1e14]">
                  Venta / Salida (- Stock)
                </h2>
                <p className="text-xs text-[#6d4c41]">
                  Descuenta del stock y calcula el monto en Bs.
                </p>
              </div>
            </div>
          </div>

          {saleFeedback && (
            <div
              role="status"
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                saleFeedback.ok
                  ? 'bg-[#eef8f1] border-[#b9dfc5] text-[#14532d]'
                  : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              }`}
            >
              {saleFeedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16a34a]" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              )}
              <span>{saleFeedback.text}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="sale-cake-select"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Torta / producto vendido
            </label>
            <select
              id="sale-cake-select"
              value={selectedSaleItem?.id || ''}
              onChange={(e) => setSaleItemId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
            >
              {finalProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {getItemIcon(item)} {item.name} —{' '}
                  {formatCurrency(item.referenceCost)} (Disp:{' '}
                  {formatNumber(item.currentStock)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sale-qty"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Cantidad vendida ({selectedSaleItem?.defaultUnit || 'Unidad'})
              </label>
              <input
                id="sale-qty"
                type="number"
                step="1"
                min="1"
                required
                value={saleQty}
                onChange={(e) => setSaleQty(e.target.value)}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8] ${
                  insufficientStock ? 'border-[#dc2626]' : 'border-[#dccbc2]'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="sale-resp"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Responsable
              </label>
              <select
                id="sale-resp"
                value={saleResp}
                onChange={(e) => setSaleResp(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              >
                {RESPONSIBLES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sale-dt"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Fecha y hora
              </label>
              <input
                id="sale-dt"
                type="datetime-local"
                required
                value={saleDateTime}
                onChange={(e) => setSaleDateTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm tabular-nums text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>

            <div>
              <label
                htmlFor="sale-notes"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Observación <span className="font-normal text-[#6d4c41]">(opcional)</span>
              </label>
              <input
                id="sale-notes"
                type="text"
                maxLength={100}
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                placeholder="Ej. Pedido cliente / vitrina"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#f462c8]"
              />
            </div>
          </div>

          {selectedSaleItem && (
            <div className="pt-2 border-t border-[#eadfd8] flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
              {insufficientStock ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#dc2626]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Stock insuficiente ({formatNumber(selectedSaleItem.currentStock)}{' '}
                  {selectedSaleItem.defaultUnit} disp.)
                </span>
              ) : (
                <span className="text-[#5a3b2e]">
                  Quedará en stock:{' '}
                  <span className="font-semibold text-[#3b1e14]">
                    {formatNumber(selectedSaleItem.currentStock - validSaleQty)}{' '}
                    {selectedSaleItem.defaultUnit}
                  </span>
                </span>
              )}

              <span className="text-sm font-bold text-[#9d176d]">
                Monto venta: {formatCurrency(saleTotalBs)}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={finalProducts.length === 0 || insufficientStock}
            className="w-full min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] disabled:opacity-50 text-[#3b1e14] text-sm font-bold transition-colors cursor-pointer"
          >
            Registrar Venta (- Stock)
          </button>
        </form>
      </div>

      {/* Catálogo y precios de tortas (Producto Terminado) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-['Fraunces'] text-xl font-bold text-[#3b1e14]">
            Catálogo y precios en vitrina
          </h2>
          <span className="text-xs font-medium text-[#6d4c41] tabular-nums">
            {finalProducts.length} productos terminados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalProducts.map((item) => {
            const isLow = item.currentStock <= item.minStock;
            const daysExp = getDaysUntilExpiry(item.nearestExpiry);
            const isExpiring = daysExp !== null && daysExp <= 7;

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
                    {getItemIcon(item)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-[#3b1e14] leading-snug">
                      {item.name}
                    </h3>
                    {item.presentation && (
                      <p className="text-xs text-[#6d4c41] mt-0.5">
                        {item.presentation}
                      </p>
                    )}

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
                          Disponible en vitrina
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#eadfd8] text-xs">
                  <div>
                    <div className="text-[#6d4c41]">Precio venta</div>
                    <div className="text-sm font-bold tabular-nums text-[#9d176d] mt-0.5">
                      {formatCurrency(item.referenceCost)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[#6d4c41]">En vitrina</div>
                    <div
                      className={`text-sm font-bold tabular-nums mt-0.5 ${
                        isLow ? 'text-[#dc2626]' : 'text-[#3b1e14]'
                      }`}
                    >
                      {formatNumber(item.currentStock)} {item.defaultUnit}
                    </div>
                  </div>

                  <div>
                    <div className="text-[#6d4c41]">Vencimiento</div>
                    <div className="text-xs font-medium tabular-nums text-[#5a3b2e] mt-1">
                      {formatDateDisplay(item.nearestExpiry)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProdItemId(item.id);
                      prodSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    className="min-h-[42px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-xs font-bold cursor-pointer transition-colors"
                  >
                    + Producción
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaleItemId(item.id);
                      saleSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    className="min-h-[42px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-xs font-bold cursor-pointer transition-colors"
                  >
                    Registrar Venta
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Historial de Producto Final (producción y ventas del mes / hoy) */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eadfd8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#3b1e14]">
              Movimientos y ventas en Producto Final
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5 tabular-nums">
              Mostrando {dailySummary.visibleMovements.length} de{' '}
              {dailySummary.allFinalMovs.length} registros en vitrina
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtrar movimientos de Producto Final"
            className="inline-flex flex-wrap p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8]"
          >
            {(
              [
                { id: 'todos', label: `Todos (${dailySummary.allFinalMovs.length})` },
                { id: 'ventas', label: 'Solo ventas' },
                { id: 'produccion', label: 'Solo producción' },
                { id: 'hoy', label: `Hoy (${dailySummary.todayMovements.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                  historyFilter === tab.id
                    ? 'bg-[#3b1e14] text-[#fff8f5]'
                    : 'text-[#5a3b2e] hover:text-[#3b1e14]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-[#eadfd8]">
          {dailySummary.visibleMovements.map((m) => {
            const linked = finalProductMap.get(m.itemId);
            return (
              <div
                key={m.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 text-sm hover:bg-[#fdf3ee] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-lg bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-base shrink-0 select-none"
                  >
                    {getItemIcon(
                      linked || {
                        name: m.itemName,
                        classification: m.classification,
                      }
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#3b1e14] truncate">
                      {m.itemName}
                    </div>
                    <div className="text-xs text-[#6d4c41] mt-0.5">
                      <span
                        className={`font-semibold ${
                          m.type === 'entrada' ? 'text-[#16a34a]' : 'text-[#9d176d]'
                        }`}
                      >
                        {m.type === 'entrada' ? 'Producción' : 'Venta / Salida'}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      {formatDateTimeDisplay(m.dateTime)}
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      {m.responsible}
                      {m.expiryDate ? ` · Vence: ${formatDateDisplay(m.expiryDate)}` : ''}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right tabular-nums">
                    <div
                      className={`font-bold ${
                        m.type === 'entrada' ? 'text-[#16a34a]' : 'text-[#9d176d]'
                      }`}
                    >
                      {m.type === 'entrada' ? '+' : '-'}
                      {formatNumber(m.quantity)} {m.unit}
                    </div>
                    <div className="text-xs font-semibold text-[#3b1e14]">
                      {formatCurrency(m.totalCost)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteMovement(m.id)}
                    aria-label={`Eliminar movimiento de ${m.itemName}`}
                    className="p-2 rounded-lg text-[#8c6d62] hover:text-[#dc2626] hover:bg-[#fef2f2] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}

          {dailySummary.visibleMovements.length === 0 && (
            <div className="p-8 text-center text-sm text-[#6d4c41]">
              No hay movimientos en Producto Final para el filtro seleccionado.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

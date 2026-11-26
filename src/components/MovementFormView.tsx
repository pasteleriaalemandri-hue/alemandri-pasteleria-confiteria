import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  CLASSIFICATIONS,
  Classification,
  ENTRY_REASONS,
  EXIT_REASONS,
  InventoryItem,
  MovementRecord,
  MovementType,
  PURCHASE_TYPES,
  PrefillMovement,
  PurchaseType,
  RESPONSIBLES,
  UNITS,
  Unit,
  convertQuantity,
} from '../types';
import {
  formatCurrency,
  formatNumber,
  getCurrentLocalDateTimeInput,
} from '../utils/formatters';

interface MovementFormViewProps {
  mode: MovementType;
  onModeChange: (mode: MovementType) => void;
  inventory: InventoryItem[];
  prefill: PrefillMovement | null;
  onClearPrefill: () => void;
  onSubmitMovement: (record: Omit<MovementRecord, 'id'>) => void;
  onGoToNewItem: () => void;
}

export function MovementFormView({
  mode,
  onModeChange,
  inventory,
  prefill,
  onClearPrefill,
  onSubmitMovement,
  onGoToNewItem,
}: MovementFormViewProps) {
  const [classification, setClassification] = useState<Classification>(
    prefill?.classification || CLASSIFICATIONS[0]
  );

  const itemsInClass = useMemo(
    () => inventory.filter((item) => item.classification === classification),
    [inventory, classification]
  );

  const [itemId, setItemId] = useState<string>(() => {
    if (prefill?.itemId) return prefill.itemId;
    const first = inventory.find((i) => i.classification === CLASSIFICATIONS[0]);
    return first?.id || '';
  });

  const selectedItem = useMemo(
    () => inventory.find((i) => i.id === itemId) || itemsInClass[0],
    [inventory, itemId, itemsInClass]
  );

  const [purchaseType, setPurchaseType] = useState<PurchaseType>('Planificada');
  const [unit, setUnit] = useState<Unit>(selectedItem?.defaultUnit || 'kg');
  const [quantity, setQuantity] = useState<string>('1');
  const [totalCost, setTotalCost] = useState<string>('');
  const [costTouched, setCostTouched] = useState<boolean>(false);
  const [reason, setReason] = useState<string>(
    mode === 'entrada' ? ENTRY_REASONS[0] : EXIT_REASONS[0]
  );
  const [responsible, setResponsible] = useState<string>(RESPONSIBLES[0]);
  const [dateTime, setDateTime] = useState<string>(getCurrentLocalDateTimeInput);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Apply prefill when user clicks "Comprar" or "Retirar" from alerts/inventory
  useEffect(() => {
    if (prefill) {
      setClassification(prefill.classification);
      setItemId(prefill.itemId);
      const target = inventory.find((i) => i.id === prefill.itemId);
      if (target) {
        setUnit(target.defaultUnit);
      }
      setCostTouched(false);
      setErrorMsg('');
      onClearPrefill();
    }
  }, [prefill, inventory, onClearPrefill]);

  // Keep itemId synced when classification changes
  useEffect(() => {
    const valid = itemsInClass.some((i) => i.id === itemId);
    if (!valid && itemsInClass.length > 0) {
      setItemId(itemsInClass[0].id);
      setUnit(itemsInClass[0].defaultUnit);
      setCostTouched(false);
    } else if (itemsInClass.length === 0) {
      setItemId('');
    }
  }, [classification, itemsInClass, itemId]);

  // Reset reason when switching between Entrada / Salida
  useEffect(() => {
    setReason(mode === 'entrada' ? ENTRY_REASONS[0] : EXIT_REASONS[0]);
    setErrorMsg('');
  }, [mode]);

  // Auto-calculate suggested cost when product, quantity, or unit changes unless user manually edited cost
  useEffect(() => {
    if (!selectedItem || costTouched) return;
    const qtyNum = parseFloat(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setTotalCost('');
      return;
    }
    const { converted } = convertQuantity(
      qtyNum,
      unit,
      selectedItem.defaultUnit
    );
    const estimated = converted * selectedItem.referenceCost;
    setTotalCost(estimated > 0 ? estimated.toFixed(2) : '0.00');
  }, [selectedItem, quantity, unit, costTouched]);

  const handleProductChange = (newId: string) => {
    setItemId(newId);
    const found = inventory.find((i) => i.id === newId);
    if (found) {
      setUnit(found.defaultUnit);
    }
    setCostTouched(false);
    setErrorMsg('');
  };

  const qtyNumber = parseFloat(quantity);
  const validQty = Number.isFinite(qtyNumber) && qtyNumber > 0 ? qtyNumber : 0;
  const stockDeltaInfo = selectedItem
    ? convertQuantity(validQty, unit, selectedItem.defaultUnit)
    : { converted: 0, isConverted: false };

  const projectedStock = selectedItem
    ? mode === 'entrada'
      ? Number((selectedItem.currentStock + stockDeltaInfo.converted).toFixed(3))
      : Number((selectedItem.currentStock - stockDeltaInfo.converted).toFixed(3))
    : 0;

  const parsedTotalCost = parseFloat(totalCost);
  const liveUnitCost =
    validQty > 0 && Number.isFinite(parsedTotalCost) && parsedTotalCost >= 0
      ? parsedTotalCost / validQty
      : null;

  const reasonOptions = mode === 'entrada' ? ENTRY_REASONS : EXIT_REASONS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedItem) {
      setErrorMsg('Selecciona un producto válido o crea un nuevo ítem.');
      return;
    }

    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      setErrorMsg('Ingresa una cantidad mayor a cero.');
      return;
    }

    const parsedCost = parseFloat(totalCost || '0');
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setErrorMsg('Ingresa un precio o costo válido.');
      return;
    }

    if (mode === 'salida' && stockDeltaInfo.converted > selectedItem.currentStock) {
      setErrorMsg(
        `No hay suficiente stock disponible (${formatNumber(selectedItem.currentStock)} ${selectedItem.defaultUnit}).`
      );
      return;
    }

    onSubmitMovement({
      type: mode,
      classification,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      purchaseType: mode === 'entrada' ? purchaseType : undefined,
      unit,
      quantity: qtyNumber,
      totalCost: parsedCost,
      reason,
      responsible,
      dateTime: dateTime || getCurrentLocalDateTimeInput(),
      expiryDate: expiryDate || undefined,
      notes: notes.trim() || undefined,
    });

    setSuccessMsg(
      mode === 'entrada'
        ? `Compra registrada: +${formatNumber(qtyNumber)} ${unit} de ${selectedItem.name}.`
        : `Retiro registrado: -${formatNumber(qtyNumber)} ${unit} de ${selectedItem.name}.`
    );

    setQuantity('1');
    setCostTouched(false);
    setExpiryDate('');
    setNotes('');
    setDateTime(getCurrentLocalDateTimeInput());
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14]">
            {mode === 'entrada'
              ? 'Registro de Entrada / Compra'
              : 'Registro de Retiro / Salida'}
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1">
            {mode === 'entrada'
              ? 'Ingresa compras de materia prima, insumos, empaques o lotes producidos.'
              : 'Registra retiros para producción diaria, pedidos, vitrina o mermas.'}
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div
          role="tablist"
          aria-label="Tipo de movimiento"
          className="inline-flex p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8] self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'entrada'}
            onClick={() => onModeChange('entrada')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
              mode === 'entrada'
                ? 'bg-[#3b1e14] text-[#fff8f5]'
                : 'text-[#5a3b2e] hover:text-[#3b1e14]'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Entrada / Compra</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'salida'}
            onClick={() => onModeChange('salida')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
              mode === 'salida'
                ? 'bg-[#3b1e14] text-[#fff8f5]'
                : 'text-[#5a3b2e] hover:text-[#3b1e14]'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Retiro / Salida</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#eef8f1] border border-[#b9dfc5] text-[#14532d] text-sm font-medium"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16a34a]" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-sm font-medium"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-[#dc2626]" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-7 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Clasificación */}
          <div>
            <label
              htmlFor="mov-classification"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Clasificación
            </label>
            <select
              id="mov-classification"
              value={classification}
              onChange={(e) => {
                setClassification(e.target.value as Classification);
                setCostTouched(false);
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            >
              {CLASSIFICATIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Producto */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="mov-product"
                className="block text-sm font-semibold text-[#3b1e14]"
              >
                Producto
              </label>
              <button
                type="button"
                onClick={onGoToNewItem}
                className="text-xs font-semibold text-[#9d176d] hover:underline cursor-pointer"
              >
                + Nuevo ítem
              </button>
            </div>
            {itemsInClass.length > 0 ? (
              <select
                id="mov-product"
                value={selectedItem?.id || ''}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {itemsInClass.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — Stock: {formatNumber(item.currentStock)} {item.defaultUnit}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#fdf3ee] border border-[#dccbc2] text-sm text-[#6d4c41] flex items-center justify-between">
                <span>Sin productos en esta clasificación</span>
                <button
                  type="button"
                  onClick={onGoToNewItem}
                  className="text-xs font-semibold text-[#9d176d] underline cursor-pointer"
                >
                  Agregar
                </button>
              </div>
            )}
          </div>

          {/* Tipo de compra (Entrada) o Referencia de inventario (Salida) */}
          {mode === 'entrada' ? (
            <div>
              <label
                htmlFor="mov-purchase-type"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Tipo de compra
              </label>
              <select
                id="mov-purchase-type"
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value as PurchaseType)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {PURCHASE_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="mov-motivo-top"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Motivo del retiro
              </label>
              <select
                id="mov-motivo-top"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cantidad + Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="mov-quantity"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Cantidad
              </label>
              <input
                id="mov-quantity"
                type="number"
                step="any"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>

            <div>
              <label
                htmlFor="mov-unit"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Unidad
              </label>
              <select
                id="mov-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Precio / Costo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="mov-cost"
                className="block text-sm font-semibold text-[#3b1e14]"
              >
                Precio / Costo total (Bs.)
              </label>
              {selectedItem && (
                <span className="text-xs text-[#6d4c41] tabular-nums">
                  Ref: {formatCurrency(selectedItem.referenceCost)} / {selectedItem.defaultUnit}
                </span>
              )}
            </div>
            <input
              id="mov-cost"
              type="number"
              step="0.01"
              min="0"
              required
              value={totalCost}
              onChange={(e) => {
                setCostTouched(true);
                setTotalCost(e.target.value);
              }}
              placeholder="0.00"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
            {mode === 'entrada' && (
              <div className="mt-1.5 text-xs text-[#5a3b2e] tabular-nums">
                Costo unitario calculado:{' '}
                <span className="font-semibold text-[#3b1e14]">
                  {liveUnitCost !== null
                    ? `${formatCurrency(liveUnitCost)} / ${unit}`
                    : '—'}
                </span>
              </div>
            )}
          </div>

          {/* Motivo (for Entrada, since Salida shows it above) or Responsable */}
          {mode === 'entrada' && (
            <div>
              <label
                htmlFor="mov-reason"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Motivo
              </label>
              <select
                id="mov-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Responsable */}
          <div>
            <label
              htmlFor="mov-responsible"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Responsable
            </label>
            <select
              id="mov-responsible"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            >
              {RESPONSIBLES.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha y hora */}
          <div>
            <label
              htmlFor="mov-datetime"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Fecha y hora
            </label>
            <input
              id="mov-datetime"
              type="datetime-local"
              required
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
          </div>

          {/* Fecha de vencimiento */}
          <div>
            <label
              htmlFor="mov-expiry"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Fecha de vencimiento <span className="font-normal text-[#6d4c41]">(opcional)</span>
            </label>
            <input
              id="mov-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
          </div>

          {/* Observación corta */}
          <div className="md:col-span-2">
            <label
              htmlFor="mov-notes"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Observación corta <span className="font-normal text-[#6d4c41]">(opcional)</span>
            </label>
            <input
              id="mov-notes"
              type="text"
              maxLength={120}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Proveedor La Europea, lote #24 o detalle del pedido"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
          </div>
        </div>

        {/* Impact preview */}
        {selectedItem && (
          <div className="pt-4 border-t border-[#eadfd8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="text-[#5a3b2e] space-y-0.5">
              <div>
                <span className="font-medium text-[#3b1e14]">{selectedItem.name}</span>
                <span className="mx-2 text-[#b9a398]" aria-hidden="true">·</span>
                <span>Stock actual: </span>
                <span className="font-semibold tabular-nums text-[#3b1e14]">
                  {formatNumber(selectedItem.currentStock)} {selectedItem.defaultUnit}
                </span>
              </div>
              {stockDeltaInfo.isConverted && (
                <div className="text-xs text-[#6d4c41]">
                  Conversión automática: {formatNumber(validQty)} {unit} equivalen a{' '}
                  <span className="font-medium tabular-nums">
                    {formatNumber(stockDeltaInfo.converted)} {selectedItem.defaultUnit}
                  </span>
                </div>
              )}
            </div>

            <div className="text-sm font-semibold tabular-nums text-[#3b1e14]">
              Nuevo stock estimado:{' '}
              <span
                className={
                  projectedStock < 0
                    ? 'text-[#dc2626]'
                    : projectedStock <= selectedItem.minStock
                    ? 'text-[#d97706]'
                    : 'text-[#16a34a]'
                }
              >
                {formatNumber(projectedStock)} {selectedItem.defaultUnit}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setQuantity('1');
              setCostTouched(false);
              setExpiryDate('');
              setNotes('');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="px-5 py-2.5 min-h-[44px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-sm font-semibold transition-colors cursor-pointer"
          >
            Limpiar campos
          </button>
          <button
            type="submit"
            disabled={!selectedItem}
            className="px-6 py-2.5 min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] active:scale-[0.99] disabled:opacity-50 text-[#3b1e14] text-sm font-bold transition-all cursor-pointer"
          >
            {mode === 'entrada' ? 'Guardar Entrada / Compra' : 'Guardar Retiro / Salida'}
          </button>
        </div>
      </form>
    </section>
  );
}

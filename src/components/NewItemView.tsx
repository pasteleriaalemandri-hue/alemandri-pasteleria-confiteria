import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  BAKERY_ICON_OPTIONS,
  CLASSIFICATIONS,
  Classification,
  InventoryItem,
  UNITS,
  Unit,
  getItemIcon,
} from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface NewItemViewProps {
  inventory: InventoryItem[];
  onAddItem: (
    item: Omit<InventoryItem, 'id' | 'updatedAt'>
  ) => void;
  onGoToEntry: (classification: Classification, itemId?: string) => void;
}

export function NewItemView({
  inventory,
  onAddItem,
}: NewItemViewProps) {
  const [name, setName] = useState('');
  const [classification, setClassification] = useState<Classification>(
    CLASSIFICATIONS[0]
  );
  const [defaultUnit, setDefaultUnit] = useState<Unit>('kg');
  const [selectedIcon, setSelectedIcon] = useState<string>('🌾');
  const [minStock, setMinStock] = useState('5');
  const [referenceCost, setReferenceCost] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [nearestExpiry, setNearestExpiry] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const existingInCategory = inventory.filter(
    (item) => item.classification === classification
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Ingresa el nombre del ítem.');
      return;
    }

    const duplicate = inventory.some(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setErrorMsg(`Ya existe un producto llamado "${trimmedName}" en el inventario.`);
      return;
    }

    const parsedMin = parseFloat(minStock);
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      setErrorMsg('El stock mínimo debe ser cero o mayor.');
      return;
    }

    const parsedCost = parseFloat(referenceCost || '0');
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setErrorMsg('El costo referencial debe ser cero o mayor.');
      return;
    }

    const parsedInitial = parseFloat(initialStock || '0');
    if (!Number.isFinite(parsedInitial) || parsedInitial < 0) {
      setErrorMsg('El stock inicial no puede ser negativo.');
      return;
    }

    onAddItem({
      name: trimmedName,
      classification,
      defaultUnit,
      minStock: parsedMin,
      referenceCost: parsedCost,
      currentStock: parsedInitial,
      icon: selectedIcon,
      nearestExpiry: nearestExpiry || undefined,
    });

    setSuccessMsg(`${selectedIcon} "${trimmedName}" se agregó correctamente en ${classification}.`);
    setName('');
    setMinStock('5');
    setReferenceCost('');
    setInitialStock('0');
    setNearestExpiry('');
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14]">
          Nuevo Ítem de Inventario
        </h1>
        <p className="text-sm text-[#6d4c41] mt-1">
          Crea materias primas, insumos, empaques o productos terminados con ícono visual, stock mínimo y costo referencial en Bs.
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-7 space-y-5"
        >
          <div>
            <label
              htmlFor="new-item-name"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Nombre del producto o insumo
            </label>
            <input
              id="new-item-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pistacho Molido Iraní o Caja Torta 30cm"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
          </div>

          {/* Visual Icon Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-sm font-semibold text-[#3b1e14]">
                Ícono visual del producto
              </span>
              <span className="text-xs text-[#6d4c41]">
                Seleccionado: <span className="text-base align-middle">{selectedIcon}</span>
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="Seleccionar ícono visual"
              className="grid grid-cols-5 sm:grid-cols-8 gap-2"
            >
              {BAKERY_ICON_OPTIONS.map((opt) => {
                const isSelected = selectedIcon === opt.emoji;
                return (
                  <button
                    key={opt.emoji}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    title={opt.label}
                    aria-label={opt.label}
                    onClick={() => setSelectedIcon(opt.emoji)}
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-2xl transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-[#fdf0f8] border-2 border-[#f462c8] scale-105'
                        : 'bg-white border border-[#dccbc2] hover:border-[#b9a398] hover:bg-[#faf4f0]'
                    }`}
                  >
                    <span aria-hidden="true">{opt.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-item-class"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Clasificación
              </label>
              <select
                id="new-item-class"
                value={classification}
                onChange={(e) => setClassification(e.target.value as Classification)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              >
                {CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="new-item-unit"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Unidad de medida base
              </label>
              <select
                id="new-item-unit"
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value as Unit)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-item-min"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Stock mínimo de alerta ({defaultUnit})
              </label>
              <input
                id="new-item-min"
                type="number"
                step="any"
                min="0"
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>

            <div>
              <label
                htmlFor="new-item-cost"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Costo referencial (Bs. por {defaultUnit})
              </label>
              <input
                id="new-item-cost"
                type="number"
                step="0.01"
                min="0"
                required
                value={referenceCost}
                onChange={(e) => setReferenceCost(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-item-initial"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Stock inicial ({defaultUnit}) <span className="font-normal text-[#6d4c41]">(opcional)</span>
              </label>
              <input
                id="new-item-initial"
                type="number"
                step="any"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>

            <div>
              <label
                htmlFor="new-item-expiry"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Vencimiento inicial <span className="font-normal text-[#6d4c41]">(opcional)</span>
              </label>
              <input
                id="new-item-expiry"
                type="date"
                value={nearestExpiry}
                onChange={(e) => setNearestExpiry(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] active:scale-[0.99] text-[#3b1e14] text-sm font-bold transition-all cursor-pointer"
            >
              Agregar al Catálogo
            </button>
          </div>
        </form>

        {/* Reference list in selected classification */}
        <aside className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[#3b1e14]">
              Existentes en {classification}
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5">
              {existingInCategory.length} productos registrados
            </p>
          </div>

          <ul className="divide-y divide-[#eadfd8] max-h-80 overflow-y-auto">
            {existingInCategory.map((item) => (
              <li key={item.id} className="py-2.5 text-sm flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">
                  {getItemIcon(item)}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-[#3b1e14] truncate">{item.name}</div>
                  <div className="text-xs text-[#6d4c41] tabular-nums mt-0.5">
                    Stock: {formatNumber(item.currentStock)} {item.defaultUnit}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    Mín: {formatNumber(item.minStock)}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    Ref: {formatCurrency(item.referenceCost)}
                  </div>
                </div>
              </li>
            ))}
            {existingInCategory.length === 0 && (
              <li className="py-4 text-xs text-[#6d4c41]">
                Aún no hay productos en esta clasificación.
              </li>
            )}
          </ul>
        </aside>
      </div>
    </section>
  );
}

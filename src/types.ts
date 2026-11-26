export const CLASSIFICATIONS = [
  'Materia Prima',
  'Insumos — Secos',
  'Insumos — Lácteos y Refrigerados',
  'Insumos — Decoración y Cacao',
  'Empaque',
  'Producto Terminado',
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

export const SUPPLY_CLASSIFICATIONS: Classification[] = [
  'Materia Prima',
  'Insumos — Secos',
  'Insumos — Lácteos y Refrigerados',
  'Insumos — Decoración y Cacao',
  'Empaque',
];

export type ScopeMode = 'todos' | 'insumos' | 'producto-final';

export function matchesScope(
  classification: Classification,
  scope: ScopeMode
): boolean {
  if (scope === 'insumos') return classification !== 'Producto Terminado';
  if (scope === 'producto-final') return classification === 'Producto Terminado';
  return true;
}

export const UNITS = [
  'Quintal',
  'kg',
  'g',
  'Libra',
  'L',
  'ml',
  'Botella',
  'Botella 1,5 L',
  'Bolsa',
  'Maple',
  'Paquete 240 g',
  'Unidad',
  'Caja',
] as const;

export type Unit = (typeof UNITS)[number];

export const PURCHASE_TYPES = ['Planificada', 'Imprevista'] as const;

export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export type MovementType = 'entrada' | 'salida';

export const ENTRY_REASONS = [
  'Compra mensual planificada',
  'Reposición semanal',
  'Compra de emergencia / quiebre',
  'Pedido especial de cliente',
  'Stock de temporada / evento',
  'Compra por promoción de proveedor',
  'Producción interna (Producto Terminado)',
  'Ajuste de inventario (+)',
] as const;

export const EXIT_REASONS = [
  'Producción diaria',
  'Pedido personalizado / torta',
  'Reposición de vitrina',
  'Venta / despacho',
  'Merma / producto dañado',
  'Vencimiento / descarte',
  'Degustación / muestra',
  'Ajuste de inventario (-)',
] as const;

export const RESPONSIBLES = [
  'Marcia',
  'Natty',
  'Monica',
  'Jossy',
  'Yenali',
  'Esther',
  'Romina',
] as const;

const LEGACY_OPERATOR_MAP: Record<string, (typeof RESPONSIBLES)[number]> = {
  'lucía alemandri': 'Marcia',
  'lucia alemandri': 'Marcia',
  'mateo vargas': 'Natty',
  'sofía méndez': 'Monica',
  'sofia mendez': 'Monica',
  'carlos paredes': 'Jossy',
  'elena rojas': 'Esther',
};

export function normalizeResponsibleName(raw?: string): string {
  const cleaned = (raw || '').trim();
  if (!cleaned) return RESPONSIBLES[0];
  const exact = RESPONSIBLES.find(
    (name) => name.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;
  const mapped = LEGACY_OPERATOR_MAP[cleaned.toLowerCase()];
  if (mapped) return mapped;
  return RESPONSIBLES[0];
}

export const BAKERY_ICON_OPTIONS: { emoji: string; label: string }[] = [
  { emoji: '🌾', label: 'Harina / Granos' },
  { emoji: '🍚', label: 'Azúcar / Secos' },
  { emoji: '🫗', label: 'Aceite / Líquidos' },
  { emoji: '🥛', label: 'Lácteos / Crema' },
  { emoji: '🍫', label: 'Chocolate / Cacao' },
  { emoji: '🥚', label: 'Huevos' },
  { emoji: '🧀', label: 'Queso crema' },
  { emoji: '🥄', label: 'Polvo para hornear' },
  { emoji: '🧪', label: 'Esencias' },
  { emoji: '🌿', label: 'Especias / Canela' },
  { emoji: '🍓', label: 'Frutilla' },
  { emoji: '🥭', label: 'Maracuyá' },
  { emoji: '✨', label: 'Decoración' },
  { emoji: '🍦', label: 'Crema chantilly / decoración' },
  { emoji: '🧂', label: 'Sal de repostería' },
  { emoji: '🔴', label: 'Colorante rojo' },
  { emoji: '🟣', label: 'Colorante morado' },
  { emoji: '⚫', label: 'Colorante negro' },
  { emoji: '🎨', label: 'Colorantes / Masa' },
  { emoji: '⚪', label: 'Bases redondas' },
  { emoji: '📦', label: 'Empaque / Cajas' },
  { emoji: '📄', label: 'Papel / Envoltura' },
  { emoji: '🥤', label: 'Popetes' },
  { emoji: '🎀', label: 'Cintas' },
  { emoji: '🥡', label: 'Envases / Domos' },
  { emoji: '🎂', label: 'Tortas' },
  { emoji: '🍰', label: 'Torta especial' },
  { emoji: '🍒', label: 'Selva Negra' },
  { emoji: '☕', label: 'Mocca / Café' },
  { emoji: '🍮', label: 'Tiramisú' },
  { emoji: '🧁', label: 'Porciones / Cupcakes' },
];

export interface InventoryItem {
  id: string;
  name: string;
  classification: Classification;
  defaultUnit: Unit;
  currentStock: number;
  minStock: number;
  referenceCost: number;
  icon?: string;
  presentation?: string;
  nearestExpiry?: string;
  updatedAt: string;
}

export function getItemIcon(
  item: Pick<InventoryItem, 'icon' | 'name' | 'classification'>
): string {
  if (item.icon) return item.icon;
  const n = item.name.toLowerCase();
  if (n.includes('harina') || n.includes('quinua')) return '🌾';
  if (n.includes('azúcar') || n.includes('azucar')) return '🍚';
  if (n.includes('aceite')) return '🫗';
  if (n.includes('huevo')) return '🥚';
  if (n.includes('polvo')) return '🥄';
  if (n.includes('vainilla') || n.includes('esencia')) return '🧪';
  if (n.includes('canela')) return '🌿';
  if (n.includes('queso')) return '🧀';
  if (n.includes('sal')) return '🧂';
  if (n.includes('colorante') && n.includes('rojo')) return '🔴';
  if (n.includes('colorante') && n.includes('morado')) return '🟣';
  if (n.includes('colorante') && n.includes('negro')) return '⚫';
  if (n.includes('chantilly')) return '🍦';
  if (n.includes('mass cream') || n.includes('crema') || n.includes('leche')) return '🥛';
  if (n.includes('chispa') || n.includes('chocolate') || n.includes('cacao') || n.includes('choc mass')) return '🍫';
  if (n.includes('maracuyá') || n.includes('maracuya')) return '🥭';
  if (n.includes('frutilla') || n.includes('fresa')) return '🍓';
  if (n.includes('colorante') || n.includes('menores de masa')) return '🎨';
  if (n.includes('rellenos')) return '✨';
  if (n.includes('base de plastoformo')) return '⚪';
  if (n.includes('papel')) return '📄';
  if (n.includes('popete')) return '🥤';
  if (n.includes('cinta')) return '🎀';
  if (n.includes('domo') || n.includes('envase')) return '🥡';
  if (n.includes('caja') || n.includes('maicena') || n.includes('empaque')) return '📦';
  if (n.includes('sacher')) return '🍰';
  if (n.includes('selva negra')) return '🍒';
  if (n.includes('mocca')) return '☕';
  if (n.includes('tiramisú') || n.includes('tiramisu')) return '🍮';
  if (n.includes('porción') || n.includes('porcion') || n.includes('cupcake')) return '🧁';
  if (n.includes('torta')) return '🎂';

  switch (item.classification) {
    case 'Materia Prima':
      return '🌾';
    case 'Insumos — Secos':
      return '🌰';
    case 'Insumos — Lácteos y Refrigerados':
      return '🥛';
    case 'Insumos — Decoración y Cacao':
      return '🍫';
    case 'Empaque':
      return '📦';
    case 'Producto Terminado':
      return '🎂';
    default:
      return '🧁';
  }
}

export function getItemSubdivision(
  item: Pick<InventoryItem, 'name' | 'classification' | 'presentation'>
): string {
  const n = item.name.toLowerCase();
  switch (item.classification) {
    case 'Materia Prima':
      if (n.includes('harina') || n.includes('quinua')) return 'Granos y Harinas';
      return 'Endulzantes y Aceites';
    case 'Insumos — Secos':
      if (n.includes('colorante')) return 'Colorantes';
      if (n.includes('polvo') || n.includes('maicena')) return 'Leudantes y Almidones';
      return 'Esencias y Especias';
    case 'Insumos — Lácteos y Refrigerados':
      if (n.includes('huevo')) return 'Huevos';
      return 'Cremas y Quesos';
    case 'Insumos — Decoración y Cacao':
      if (
        n.includes('cacao') ||
        n.includes('choc') ||
        n.includes('chocolate')
      ) {
        return 'Cacao y Chocolates';
      }
      return 'Jaleas y Rellenos';
    case 'Empaque':
      if (n.includes('base de plastoformo')) return 'Bases de plastoformo';
      if (n.includes('caja') || n.includes('domo') || n.includes('envase')) {
        return 'Cajas y Domos';
      }
      return 'Envoltura y Accesorios';
    case 'Producto Terminado':
      if (n.includes('porción') || n.includes('porcion')) return 'Porciones';
      if (
        item.presentation?.toLowerCase().includes('especial') ||
        n.includes('especial')
      ) {
        return 'Tortas Especiales (Mediana 2)';
      }
      return 'Tortas de Vitrina';
    default:
      return 'General';
  }
}

export interface MovementRecord {
  id: string;
  type: MovementType;
  classification: Classification;
  itemId: string;
  itemName: string;
  purchaseType?: PurchaseType;
  unit: Unit;
  quantity: number;
  totalCost: number;
  reason: string;
  responsible: string;
  dateTime: string;
  expiryDate?: string;
  notes?: string;
}

export type AppTab =
  | 'dashboard'
  | 'catalogo'
  | 'producto-final'
  | 'entrada'
  | 'salida'
  | 'inventario'
  | 'nuevo-item'
  | 'configuracion';

export interface AppSettings {
  sheetsWebAppUrl: string;
  autoSync: boolean;
  customLogoUrl: string;
  lastSyncAt?: string;
}

export interface PrefillMovement {
  type: MovementType;
  classification: Classification;
  itemId: string;
}

/**
 * Converts a quantity from `fromUnit` into `toUnit` when units belong
 * to the same physical dimension (mass or volume).
 * Uses 1 Quintal = 46 kg (standard commercial bakery quintal).
 */
export function convertQuantity(quantity: number, fromUnit: Unit, toUnit: Unit): {
  converted: number;
  isConverted: boolean;
} {
  if (fromUnit === toUnit) {
    return { converted: quantity, isConverted: false };
  }

  const massToGrams: Partial<Record<Unit, number>> = {
    Quintal: 46000,
    kg: 1000,
    Libra: 453.592,
    g: 1,
  };

  if (massToGrams[fromUnit] && massToGrams[toUnit]) {
    const grams = quantity * massToGrams[fromUnit]!;
    return {
      converted: Number((grams / massToGrams[toUnit]!).toFixed(3)),
      isConverted: true,
    };
  }

  const volumeToMl: Partial<Record<Unit, number>> = {
    L: 1000,
    ml: 1,
  };

  if (volumeToMl[fromUnit] && volumeToMl[toUnit]) {
    const ml = quantity * volumeToMl[fromUnit]!;
    return {
      converted: Number((ml / volumeToMl[toUnit]!).toFixed(3)),
      isConverted: true,
    };
  }

  return { converted: quantity, isConverted: false };
}

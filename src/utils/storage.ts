import {
  AppSettings,
  InventoryItem,
  MovementRecord,
  normalizeResponsibleName,
} from '../types';
import { createSeedInventory, createSeedMovements } from '../data/seedData';

const LEGACY_KEYS = [
  'alemandri_inventory_v1',
  'alemandri_movements_v1',
  'alemandri_inventory_v2',
  'alemandri_movements_v2',
  'alemandri_inventory_v3',
  'alemandri_movements_v3',
  'alemandri_inventory_v4',
  'alemandri_movements_v4',
  'alemandri_inventory_v5',
  'alemandri_movements_v5',
  'alemandri_inventory_v6',
  'alemandri_movements_v6',
  'alemandri_inventory_v7',
  'alemandri_movements_v7',
];
const INVENTORY_KEY = 'alemandri_inventory_v8';
const MOVEMENTS_KEY = 'alemandri_movements_v8';
const SEED_VERSION_KEY = 'alemandri_seed_version';
const CURRENT_SEED_VERSION = '2026-11-nov-v8';
const SETTINGS_KEY = 'alemandri_settings_v1';

export const DEFAULT_LOGO_URL =
  '/assets/aistudio/Captura_de_pantalla_2026-11-24_114041-removebg-preview_c7139561.png';

export function clearLegacyStorage(): void {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors silently
  }
}

function ensureLatestSeedApplied(): void {
  clearLegacyStorage();
  try {
    if (localStorage.getItem(SEED_VERSION_KEY) === CURRENT_SEED_VERSION) {
      return;
    }
    clearAllDataStorage();
    const seededInv = createSeedInventory();
    const seededMov = createSeedMovements();
    saveInventory(seededInv);
    saveMovements(seededMov);
    localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
  } catch {
    // Ignore storage errors silently
  }
}

export function loadInventory(): InventoryItem[] {
  ensureLatestSeedApplied();
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) {
      const seeded = createSeedInventory();
      saveInventory(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback to seed data if storage is unavailable or corrupted
  }
  const seeded = createSeedInventory();
  saveInventory(seeded);
  return seeded;
}

export function saveInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function loadMovements(): MovementRecord[] {
  ensureLatestSeedApplied();
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    if (!raw) {
      const seeded = createSeedMovements();
      saveMovements(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((m) => ({
        ...m,
        responsible: normalizeResponsibleName(m?.responsible),
      }));
    }
  } catch {
    // Fallback to seed data
  }
  const seeded = createSeedMovements();
  saveMovements(seeded);
  return seeded;
}

export function saveMovements(movements: MovementRecord[]): void {
  try {
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function loadSettings(): AppSettings {
  const defaults: AppSettings = {
    sheetsWebAppUrl: '',
    autoSync: true,
    customLogoUrl: '',
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function clearAllDataStorage(): void {
  clearLegacyStorage();
  try {
    localStorage.removeItem(INVENTORY_KEY);
    localStorage.removeItem(MOVEMENTS_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('alemandri_inventory_') ||
          k.startsWith('alemandri_movements_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors silently
  }
}

export function resetDemoData(): {
  inventory: InventoryItem[];
  movements: MovementRecord[];
} {
  clearAllDataStorage();
  const inventory = createSeedInventory();
  const movements = createSeedMovements();
  saveInventory(inventory);
  saveMovements(movements);
  try {
    localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
  } catch {
    // Ignore storage errors silently
  }
  return { inventory, movements };
}

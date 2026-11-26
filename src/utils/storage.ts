import { AppSettings, InventoryItem, MovementRecord } from '../types';
import { createSeedInventory, createSeedMovements } from '../data/seedData';

const LEGACY_KEYS = [
  'alemandri_inventory_v1',
  'alemandri_movements_v1',
  'alemandri_inventory_v2',
  'alemandri_movements_v2',
  'alemandri_inventory_v3',
  'alemandri_movements_v3',
];
const INVENTORY_KEY = 'alemandri_inventory_v4';
const MOVEMENTS_KEY = 'alemandri_movements_v4';
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

export function loadInventory(): InventoryItem[] {
  clearLegacyStorage();
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
  clearLegacyStorage();
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    if (!raw) {
      const seeded = createSeedMovements();
      saveMovements(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
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
  return { inventory, movements };
}

import { InventoryItem, MovementRecord } from '../types';

export interface SheetsPostPayload {
  action: 'nuevo_item' | 'entrada' | 'salida' | 'eliminar_item' | 'sync_full';
  timestamp: string;
  replaceAll?: boolean;
  itemId?: string;
  item?: InventoryItem;
  movement?: MovementRecord;
  updatedItem?: InventoryItem;
  inventory?: InventoryItem[];
  movements?: MovementRecord[];
  finalProducts?: InventoryItem[];
  finalProductMovements?: MovementRecord[];
}

export interface SheetsSyncResult {
  ok: boolean;
  message: string;
  inventory?: InventoryItem[];
  movements?: MovementRecord[];
}

export function buildSeparatedSyncPayload(
  inventory: InventoryItem[],
  movements: MovementRecord[],
  replaceAll = false
): SheetsPostPayload {
  const suppliesInventory = inventory.filter(
    (item) => item.classification !== 'Producto Terminado'
  );
  const finalProducts = inventory.filter(
    (item) => item.classification === 'Producto Terminado'
  );
  const suppliesMovements = movements.filter(
    (mov) => mov.classification !== 'Producto Terminado'
  );
  const finalProductMovements = movements.filter(
    (mov) => mov.classification === 'Producto Terminado'
  );

  return {
    action: 'sync_full',
    timestamp: new Date().toISOString(),
    replaceAll,
    inventory: suppliesInventory,
    movements: suppliesMovements,
    finalProducts,
    finalProductMovements,
  };
}

/**
 * Sends a JSON payload via POST to a Google Apps Script Web App URL.
 * Uses text/plain;charset=utf-8 to prevent browser CORS preflight (OPTIONS)
 * failures on Google Apps Script while preserving valid JSON in e.postData.contents.
 */
export async function postToGoogleSheets(
  webAppUrl: string,
  payload: SheetsPostPayload
): Promise<{ ok: boolean; message: string }> {
  const trimmedUrl = webAppUrl.trim();
  if (!trimmedUrl) {
    return { ok: false, message: 'No hay URL de Google Sheets configurada.' };
  }

  try {
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Google Sheets respondió con estado ${response.status}.`,
      };
    }

    return {
      ok: true,
      message: 'Sincronizado en línea con Google Sheets.',
    };
  } catch {
    // Fallback with no-cors in case the Apps Script deployment redirects without CORS headers on POST
    try {
      await fetch(trimmedUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return {
        ok: true,
        message: 'Enviado a Google Sheets.',
      };
    } catch {
      return {
        ok: false,
        message: 'No se pudo conectar con Google Sheets. Verifica tu conexión o URL.',
      };
    }
  }
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of primary) {
    if (item?.id) map.set(item.id, item);
  }
  for (const item of secondary) {
    if (item?.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * Fetches inventory, final products, and movements via GET from the Google Apps Script Web App URL
 * so laptop and mobile stay synchronized.
 */
export async function syncFromGoogleSheets(
  webAppUrl: string
): Promise<SheetsSyncResult> {
  const trimmedUrl = webAppUrl.trim();
  if (!trimmedUrl) {
    return {
      ok: false,
      message: 'Ingresa una URL de Web App de Google Apps Script primero.',
    };
  }

  try {
    const separator = trimmedUrl.includes('?') ? '&' : '?';
    const urlWithCacheBust = `${trimmedUrl}${separator}t=${Date.now()}`;
    const response = await fetch(urlWithCacheBust, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Error al sincronizar (HTTP ${response.status}).`,
      };
    }

    const data = await response.json();
    const baseInventory = Array.isArray(data?.inventory)
      ? (data.inventory as InventoryItem[])
      : Array.isArray(data?.items)
      ? (data.items as InventoryItem[])
      : undefined;

    const finalProducts = Array.isArray(data?.finalProducts)
      ? (data.finalProducts as InventoryItem[])
      : undefined;

    const baseMovements = Array.isArray(data?.movements)
      ? (data.movements as MovementRecord[])
      : undefined;

    const finalProductMovements = Array.isArray(data?.finalProductMovements)
      ? (data.finalProductMovements as MovementRecord[])
      : undefined;

    const incomingInventory =
      baseInventory || finalProducts
        ? mergeById(baseInventory || [], finalProducts || [])
        : undefined;

    const incomingMovements =
      baseMovements || finalProductMovements
        ? mergeById(baseMovements || [], finalProductMovements || [])
        : undefined;

    if (!incomingInventory && !incomingMovements) {
      return {
        ok: false,
        message:
          'La respuesta del script no contiene arreglos "inventory" ni "movements".',
      };
    }

    return {
      ok: true,
      message: `Sincronización completada (${incomingInventory?.length ?? 0} ítems, ${incomingMovements?.length ?? 0} movimientos).`,
      inventory: incomingInventory,
      movements: incomingMovements,
    };
  } catch {
    return {
      ok: false,
      message:
        'No se pudo leer desde Google Sheets. Verifica que el script esté implementado como "Cualquier persona".',
    };
  }
}

export const APPS_SCRIPT_TEMPLATE = `// Pega este código en Extensiones > Apps Script dentro de tu Google Sheet
// Luego haz clic en Implementar > Nueva implementación > Aplicación web (Acceso: Cualquier persona)

function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName('Inventario') || ss.insertSheet('Inventario');
  var movSheet = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
  var ptSheet = ss.getSheetByName('Producto Terminado') || ss.insertSheet('Producto Terminado');
  var ptMovSheet = ss.getSheetByName('Movimientos Producto Terminado') || ss.insertSheet('Movimientos Producto Terminado');

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      inventory: sheetToObjects_(invSheet),
      movements: sheetToObjects_(movSheet),
      finalProducts: sheetToObjects_(ptSheet),
      finalProductMovements: sheetToObjects_(ptMovSheet)
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName('Inventario') || ss.insertSheet('Inventario');
  var movSheet = ss.getSheetByName('Movimientos') || ss.insertSheet('Movimientos');
  var ptSheet = ss.getSheetByName('Producto Terminado') || ss.insertSheet('Producto Terminado');
  var ptMovSheet = ss.getSheetByName('Movimientos Producto Terminado') || ss.insertSheet('Movimientos Producto Terminado');

  if (payload.action === 'nuevo_item' && payload.item) {
    var targetInv = payload.item.classification === 'Producto Terminado' ? ptSheet : invSheet;
    upsertInventoryRow_(targetInv, payload.item);
  }

  if (payload.action === 'eliminar_item' && payload.itemId) {
    deleteInventoryRow_(invSheet, payload.itemId);
    deleteInventoryRow_(ptSheet, payload.itemId);
  }

  if ((payload.action === 'entrada' || payload.action === 'salida') && payload.movement) {
    var isFinalMov = payload.movement.classification === 'Producto Terminado';
    appendMovementRow_(isFinalMov ? ptMovSheet : movSheet, payload.movement);
    if (payload.updatedItem) {
      var isFinalItem = payload.updatedItem.classification === 'Producto Terminado';
      upsertInventoryRow_(isFinalItem ? ptSheet : invSheet, payload.updatedItem);
    }
  }

  if (payload.action === 'sync_full') {
    var suppliesInv = payload.inventory || [];
    var finalInv = payload.finalProducts || [];
    var suppliesMov = payload.movements || [];
    var finalMov = payload.finalProductMovements || [];

    if (payload.replaceAll) {
      clearSheetData_(invSheet, getInventoryHeaders_());
      clearSheetData_(ptSheet, getInventoryHeaders_());
      clearSheetData_(movSheet, getMovementHeaders_());
      clearSheetData_(ptMovSheet, getMovementHeaders_());
    }

    suppliesInv.forEach(function(it) {
      upsertInventoryRow_(it.classification === 'Producto Terminado' ? ptSheet : invSheet, it);
    });
    finalInv.forEach(function(it) {
      upsertInventoryRow_(ptSheet, it);
    });
    suppliesMov.forEach(function(mv) {
      appendMovementRow_(mv.classification === 'Producto Terminado' ? ptMovSheet : movSheet, mv);
    });
    finalMov.forEach(function(mv) {
      appendMovementRow_(ptMovSheet, mv);
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getInventoryHeaders_() {
  return ['id','name','classification','presentation','defaultUnit','currentStock','minStock','referenceCost','icon','nearestExpiry','updatedAt'];
}

function getMovementHeaders_() {
  return ['id','type','classification','itemId','itemName','purchaseType','unit','quantity','totalCost','reason','responsible','dateTime','expiryDate','notes'];
}

function clearSheetData_(sheet, headers) {
  sheet.clearContents();
  sheet.appendRow(headers);
}

function sheetToObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, idx) { if (h) obj[h] = row[idx]; });
    return obj;
  });
}

function upsertInventoryRow_(sheet, item) {
  var headers = getInventoryHeaders_();
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  var data = sheet.getDataRange().getValues();
  var rowValues = headers.map(function(h){ return item[h] !== undefined ? item[h] : ''; });
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === item.id) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function appendMovementRow_(sheet, mov) {
  var headers = getMovementHeaders_();
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  var rowValues = headers.map(function(h){ return mov[h] !== undefined ? mov[h] : ''; });
  sheet.appendRow(rowValues);
}

function deleteInventoryRow_(sheet, itemId) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === itemId) {
      sheet.deleteRow(i + 1);
    }
  }
}`;

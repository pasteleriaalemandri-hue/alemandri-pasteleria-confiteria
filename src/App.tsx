import { useCallback, useEffect, useState } from 'react';
import {
  AppSettings,
  AppTab,
  Classification,
  InventoryItem,
  MovementRecord,
  MovementType,
  PrefillMovement,
  convertQuantity,
  normalizeResponsibleName,
} from './types';
import {
  DEFAULT_LOGO_URL,
  clearAllDataStorage,
  loadInventory,
  loadMovements,
  loadSettings,
  resetDemoData,
  saveInventory,
  saveMovements,
  saveSettings,
} from './utils/storage';
import {
  buildSeparatedSyncPayload,
  postToGoogleSheets,
  syncFromGoogleSheets,
} from './utils/sheetsSync';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { DashboardView } from './components/DashboardView';
import { MovementFormView } from './components/MovementFormView';
import { NewItemView } from './components/NewItemView';
import { InventoryView } from './components/InventoryView';
import { CatalogView } from './components/CatalogView';
import { FinalProductsView } from './components/FinalProductsView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadInventory());
  const [movements, setMovements] = useState<MovementRecord[]>(() => loadMovements());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [isConfigUnlocked, setIsConfigUnlocked] = useState<boolean>(false);
  const [prefill, setPrefill] = useState<PrefillMovement | null>(null);
  const [syncNotice, setSyncNotice] = useState<string>('');
  const [isHeaderSyncing, setIsHeaderSyncing] = useState<boolean>(false);

  const activeLogoUrl = settings.customLogoUrl || DEFAULT_LOGO_URL;

  useEffect(() => {
    saveInventory(inventory);
  }, [inventory]);

  useEffect(() => {
    saveMovements(movements);
  }, [movements]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const showSyncToast = (msg: string) => {
    setSyncNotice(msg);
    window.setTimeout(() => setSyncNotice(''), 3500);
  };

  const handleNavigate = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickMovement = useCallback(
    (type: MovementType, classification: Classification, itemId: string) => {
      setPrefill({ type, classification, itemId });
      setActiveTab(type === 'entrada' ? 'entrada' : 'salida');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleClearPrefill = useCallback(() => {
    setPrefill(null);
  }, []);

  const handleSubmitMovement = (record: Omit<MovementRecord, 'id'>) => {
    const newMovement: MovementRecord = {
      ...record,
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    setMovements((prev) => [newMovement, ...prev]);

    let updatedItemForSync: InventoryItem | undefined;

    setInventory((prev) =>
      prev.map((item) => {
        if (item.id !== record.itemId) return item;
        const { converted } = convertQuantity(
          record.quantity,
          record.unit,
          item.defaultUnit
        );
        const delta = record.type === 'entrada' ? converted : -converted;
        const nextStock = Math.max(0, Number((item.currentStock + delta).toFixed(3)));

        let nextExpiry = item.nearestExpiry;
        if (record.type === 'entrada' && record.expiryDate) {
          if (
            record.classification === 'Producto Terminado' ||
            !item.nearestExpiry ||
            item.currentStock <= 0 ||
            record.expiryDate < item.nearestExpiry
          ) {
            nextExpiry = record.expiryDate;
          }
        }

        const updated: InventoryItem = {
          ...item,
          currentStock: nextStock,
          nearestExpiry: nextExpiry,
          updatedAt: new Date().toISOString(),
        };
        updatedItemForSync = updated;
        return updated;
      })
    );

    if (settings.autoSync && settings.sheetsWebAppUrl.trim()) {
      void postToGoogleSheets(settings.sheetsWebAppUrl, {
        action: record.type,
        timestamp: new Date().toISOString(),
        movement: newMovement,
        updatedItem: updatedItemForSync,
      }).then((res) => {
        showSyncToast(res.message);
      });
    }
  };

  const handleDeleteMovement = (movementId: string) => {
    const target = movements.find((m) => m.id === movementId);
    if (!target) return;

    setMovements((prev) => prev.filter((m) => m.id !== movementId));

    setInventory((prev) =>
      prev.map((item) => {
        if (item.id !== target.itemId) return item;
        const { converted } = convertQuantity(
          target.quantity,
          target.unit,
          item.defaultUnit
        );
        const revertDelta = target.type === 'entrada' ? -converted : converted;
        const nextStock = Math.max(
          0,
          Number((item.currentStock + revertDelta).toFixed(3))
        );
        return {
          ...item,
          currentStock: nextStock,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleAddItem = (
    newItemData: Omit<InventoryItem, 'id' | 'updatedAt'>
  ) => {
    const item: InventoryItem = {
      ...newItemData,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };
    setInventory((prev) => [item, ...prev]);

    if (settings.autoSync && settings.sheetsWebAppUrl.trim()) {
      void postToGoogleSheets(settings.sheetsWebAppUrl, {
        action: 'nuevo_item',
        timestamp: new Date().toISOString(),
        item,
      }).then((res) => {
        showSyncToast(res.message);
      });
    }
  };

  const handleUpdateMinStock = (itemId: string, minStock: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, minStock, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleDeleteItem = async (
    itemId: string
  ): Promise<{ ok: boolean; message: string }> => {
    const target = inventory.find((i) => i.id === itemId);
    if (!target) {
      return {
        ok: false,
        message: 'No se encontró el ítem seleccionado.',
      };
    }

    setInventory((prev) => prev.filter((item) => item.id !== itemId));

    const targetUrl = settings.sheetsWebAppUrl.trim();
    if (!targetUrl) {
      const msg = `Ítem "${target.name}" eliminado del catálogo e inventario.`;
      showSyncToast(msg);
      return { ok: true, message: msg };
    }

    const res = await postToGoogleSheets(targetUrl, {
      action: 'eliminar_item',
      timestamp: new Date().toISOString(),
      itemId,
    });

    if (res.ok) {
      const msg = `Ítem "${target.name}" eliminado y actualizado en Google Sheets.`;
      showSyncToast(msg);
      return { ok: true, message: msg };
    }

    const warnMsg = `Ítem "${target.name}" eliminado en este dispositivo, pero falló la sincronización con Google Sheets: ${res.message}`;
    showSyncToast(warnMsg);
    return { ok: true, message: warnMsg };
  };

  const handleResetDemo = () => {
    setInventory([]);
    setMovements([]);
    clearAllDataStorage();
    const { inventory: freshInv, movements: freshMov } = resetDemoData();
    setInventory(freshInv);
    setMovements(freshMov);
  };

  const handleSyncNow = useCallback(
    async (overrideUrl?: string): Promise<{
      ok: boolean;
      message: string;
    }> => {
      const targetUrl = (overrideUrl ?? settings.sheetsWebAppUrl).trim();
      const res = await syncFromGoogleSheets(targetUrl);
      if (res.ok) {
        if (res.inventory && res.inventory.length > 0) {
          const normalizedInv: InventoryItem[] = res.inventory.map((it) => ({
            ...it,
            currentStock: Number(it.currentStock) || 0,
            minStock: Number(it.minStock) || 0,
            referenceCost: Number(it.referenceCost) || 0,
            nearestExpiry: it.nearestExpiry
              ? String(it.nearestExpiry).slice(0, 10)
              : undefined,
          }));
          setInventory(normalizedInv);
        }
        if (res.movements && res.movements.length > 0) {
          const normalizedMov: MovementRecord[] = res.movements.map((mv) => ({
            ...mv,
            quantity: Number(mv.quantity) || 0,
            totalCost: Number(mv.totalCost) || 0,
            purchaseType: mv.purchaseType || undefined,
            responsible: normalizeResponsibleName(mv.responsible),
            expiryDate: mv.expiryDate
              ? String(mv.expiryDate).slice(0, 10)
              : undefined,
          }));
          setMovements(normalizedMov);
        }
        setSettings((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
        }));
      }
      return { ok: res.ok, message: res.message };
    },
    [settings.sheetsWebAppUrl]
  );

  // Automatic GET sync on page load when Google Apps Script URL is configured (no PIN required)
  useEffect(() => {
    if (!settings.sheetsWebAppUrl.trim()) return;
    let cancelled = false;
    setIsHeaderSyncing(true);
    void handleSyncNow().then((res) => {
      if (cancelled) return;
      setIsHeaderSyncing(false);
      if (res.ok) {
        showSyncToast(res.message);
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHeaderSync = async () => {
    if (!settings.sheetsWebAppUrl.trim()) {
      showSyncToast(
        'Configura primero tu URL de Google Sheets en la pestaña Configuración (PIN 1234).'
      );
      return;
    }
    setIsHeaderSyncing(true);
    const res = await handleSyncNow();
    setIsHeaderSyncing(false);
    showSyncToast(res.message);
  };

  const handlePushAllNow = async (
    overrideUrl?: string
  ): Promise<{ ok: boolean; message: string }> => {
    const targetUrl = (overrideUrl ?? settings.sheetsWebAppUrl).trim();
    const payload = buildSeparatedSyncPayload(inventory, movements, false);
    const res = await postToGoogleSheets(targetUrl, payload);
    if (res.ok) {
      setSettings((prev) => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
      }));
    }
    return res;
  };

  const handleLoadRealInitialData = async (
    overrideUrl?: string
  ): Promise<{ ok: boolean; message: string }> => {
    setInventory([]);
    setMovements([]);
    clearAllDataStorage();
    const { inventory: freshInv, movements: freshMov } = resetDemoData();
    setInventory(freshInv);
    setMovements(freshMov);

    const targetUrl = (overrideUrl ?? settings.sheetsWebAppUrl).trim();
    if (!targetUrl) {
      return {
        ok: true,
        message: `Datos reales iniciales de Alemandri cargados (${freshInv.length} ítems y ${freshMov.length} movimientos). Configura tu URL de Google Sheets para sincronizarlos en línea.`,
      };
    }

    const payload = buildSeparatedSyncPayload(freshInv, freshMov, true);
    const res = await postToGoogleSheets(targetUrl, payload);
    if (res.ok) {
      setSettings((prev) => ({
        ...prev,
        lastSyncAt: new Date().toISOString(),
      }));
      return {
        ok: true,
        message: `Datos reales iniciales de Alemandri cargados (${freshInv.length} ítems, ${freshMov.length} movimientos) y enviados a Google Sheets (sync_full separado por Inventario y Producto Terminado).`,
      };
    }

    return {
      ok: false,
      message: `Datos reales cargados en este dispositivo, pero falló el envío a Google Sheets: ${res.message}`,
    };
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf6f3] text-[#2b1811]">
      <Header
        activeTab={activeTab}
        logoUrl={activeLogoUrl}
        isSyncing={isHeaderSyncing}
        onNavigate={handleNavigate}
        onQuickEntry={() => handleNavigate('entrada')}
        onQuickSync={handleHeaderSync}
      />

      {syncNotice && (
        <div
          role="status"
          className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-3"
        >
          <div className="px-4 py-2 rounded-xl bg-[#fff8f5] border border-[#f462c8] text-xs font-medium text-[#3b1e14]">
            {syncNotice}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 lg:pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            inventory={inventory}
            movements={movements}
            logoUrl={activeLogoUrl}
            onQuickMovement={handleQuickMovement}
            onDeleteMovement={handleDeleteMovement}
            onGoToInventory={() => handleNavigate('inventario')}
          />
        )}

        {activeTab === 'catalogo' && (
          <CatalogView
            inventory={inventory}
            onGoToNewItem={() => handleNavigate('nuevo-item')}
          />
        )}

        {activeTab === 'producto-final' && (
          <FinalProductsView
            inventory={inventory}
            movements={movements}
            logoUrl={activeLogoUrl}
            onSubmitMovement={handleSubmitMovement}
            onAddItem={handleAddItem}
            onDeleteMovement={handleDeleteMovement}
          />
        )}

        {(activeTab === 'entrada' || activeTab === 'salida') && (
          <MovementFormView
            mode={activeTab}
            onModeChange={(nextMode) => handleNavigate(nextMode)}
            inventory={inventory}
            prefill={prefill}
            onClearPrefill={handleClearPrefill}
            onSubmitMovement={handleSubmitMovement}
            onGoToNewItem={() => handleNavigate('nuevo-item')}
          />
        )}

        {activeTab === 'inventario' && (
          <InventoryView
            inventory={inventory}
            onQuickMovement={handleQuickMovement}
            onUpdateMinStock={handleUpdateMinStock}
            onResetDemo={handleResetDemo}
            onGoToNewItem={() => handleNavigate('nuevo-item')}
          />
        )}

        {activeTab === 'nuevo-item' && (
          <NewItemView
            inventory={inventory}
            onAddItem={handleAddItem}
            onGoToEntry={(classification, itemId) =>
              handleQuickMovement('entrada', classification, itemId || '')
            }
          />
        )}

        {activeTab === 'configuracion' && (
          <SettingsView
            settings={settings}
            inventory={inventory}
            isUnlocked={isConfigUnlocked}
            onUnlock={() => setIsConfigUnlocked(true)}
            onLock={() => setIsConfigUnlocked(false)}
            onUpdateSettings={setSettings}
            onSyncNow={handleSyncNow}
            onPushAllNow={handlePushAllNow}
            onLoadRealInitialData={handleLoadRealInitialData}
            onDeleteItem={handleDeleteItem}
          />
        )}
      </main>

      <MobileNav activeTab={activeTab} onNavigate={handleNavigate} />
    </div>
  );
}

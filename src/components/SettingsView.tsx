import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  DatabaseBackup,
  ImagePlus,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  AppSettings,
  CLASSIFICATIONS,
  InventoryItem,
  getItemIcon,
} from '../types';
import { APPS_SCRIPT_TEMPLATE } from '../utils/sheetsSync';
import { DEFAULT_LOGO_URL } from '../utils/storage';
import { formatDateTimeDisplay, formatNumber } from '../utils/formatters';

interface SettingsViewProps {
  settings: AppSettings;
  inventory: InventoryItem[];
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onUpdateSettings: (next: AppSettings) => void;
  onSyncNow: (overrideUrl?: string) => Promise<{ ok: boolean; message: string }>;
  onPushAllNow: (overrideUrl?: string) => Promise<{ ok: boolean; message: string }>;
  onLoadRealInitialData: (
    overrideUrl?: string
  ) => Promise<{ ok: boolean; message: string }>;
  onDeleteItem: (itemId: string) => Promise<{ ok: boolean; message: string }>;
}

const VALID_PIN = '1234';

export function SettingsView({
  settings,
  inventory,
  isUnlocked,
  onUnlock,
  onLock,
  onUpdateSettings,
  onSyncNow,
  onPushAllNow,
  onLoadRealInitialData,
  onDeleteItem,
}: SettingsViewProps) {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [urlInput, setUrlInput] = useState(settings.sheetsWebAppUrl);
  const [autoSync, setAutoSync] = useState(settings.autoSync);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [deleteItemId, setDeleteItemId] = useState('');
  const [deleteSecretKey, setDeleteSecretKey] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const activeLogo = settings.customLogoUrl || DEFAULT_LOGO_URL;

  const selectedItemToDelete = useMemo(
    () => inventory.find((item) => item.id === deleteItemId) || null,
    [inventory, deleteItemId]
  );

  const groupedInventory = useMemo(() => {
    return CLASSIFICATIONS.map((classification) => ({
      classification,
      items: inventory
        .filter((item) => item.classification === classification)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })).filter((group) => group.items.length > 0);
  }, [inventory]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === VALID_PIN) {
      setPinError('');
      setPinInput('');
      onUnlock();
    } else {
      setPinError('PIN incorrecto. Ingresa el PIN de 4 dígitos.');
    }
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      sheetsWebAppUrl: urlInput.trim(),
      autoSync,
    });
    setStatusMsg({
      ok: true,
      text: 'Configuración de Google Sheets guardada correctamente.',
    });
  };

  const handleSyncClick = async () => {
    const trimmed = urlInput.trim();
    if (trimmed !== settings.sheetsWebAppUrl || autoSync !== settings.autoSync) {
      onUpdateSettings({
        ...settings,
        sheetsWebAppUrl: trimmed,
        autoSync,
      });
    }
    setIsSyncing(true);
    setStatusMsg(null);
    const res = await onSyncNow(trimmed);
    setStatusMsg({ ok: res.ok, text: res.message });
    setIsSyncing(false);
  };

  const handlePushAllClick = async () => {
    const trimmed = urlInput.trim();
    if (trimmed !== settings.sheetsWebAppUrl || autoSync !== settings.autoSync) {
      onUpdateSettings({
        ...settings,
        sheetsWebAppUrl: trimmed,
        autoSync,
      });
    }
    setIsPushing(true);
    setStatusMsg(null);
    const res = await onPushAllNow(trimmed);
    setStatusMsg({ ok: res.ok, text: res.message });
    setIsPushing(false);
  };

  const handleLoadRealDataClick = async () => {
    const trimmed = urlInput.trim();
    if (trimmed !== settings.sheetsWebAppUrl || autoSync !== settings.autoSync) {
      onUpdateSettings({
        ...settings,
        sheetsWebAppUrl: trimmed,
        autoSync,
      });
    }
    setIsLoadingInitial(true);
    setStatusMsg(null);
    const res = await onLoadRealInitialData(trimmed);
    setStatusMsg({ ok: res.ok, text: res.message });
    setIsLoadingInitial(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({
        ok: false,
        text: 'La imagen supera los 2 MB. Elige un archivo más ligero.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        onUpdateSettings({
          ...settings,
          customLogoUrl: result,
        });
        setStatusMsg({
          ok: true,
          text: 'Logotipo actualizado en el encabezado principal.',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    onUpdateSettings({
      ...settings,
      customLogoUrl: '',
    });
    setStatusMsg({
      ok: true,
      text: 'Se restauró el logotipo original de Alemandri.',
    });
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDeleteItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteFeedback(null);

    if (!selectedItemToDelete) {
      setDeleteFeedback({
        ok: false,
        text: 'Selecciona primero el ítem que deseas eliminar.',
      });
      return;
    }

    if (!deleteConfirmed) {
      setDeleteFeedback({
        ok: false,
        text: 'Marca la casilla de confirmación explícita antes de eliminar.',
      });
      return;
    }

    if (deleteSecretKey.trim() !== VALID_PIN) {
      setDeleteFeedback({
        ok: false,
        text: 'Clave secreta incorrecta. Ingresa la clave válida para autorizar la eliminación.',
      });
      return;
    }

    setIsDeletingItem(true);
    const res = await onDeleteItem(selectedItemToDelete.id);
    setIsDeletingItem(false);

    if (res.ok) {
      setDeleteItemId('');
      setDeleteSecretKey('');
      setDeleteConfirmed(false);
    }
    setDeleteFeedback({ ok: res.ok, text: res.message });
  };

  if (!isUnlocked) {
    return (
      <section className="max-w-md mx-auto pt-4">
        <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#3b1e14] text-[#f462c8] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-['Fraunces'] text-xl font-bold text-[#3b1e14]">
                Configuración Protegida
              </h1>
              <p className="text-xs text-[#6d4c41]">
                Ingresa el PIN de acceso para editar Google Sheets y el logotipo.
              </p>
            </div>
          </div>

          {pinError && (
            <div
              role="alert"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="config-pin"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                PIN de seguridad
              </label>
              <input
                id="config-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-base tracking-widest tabular-nums focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14] text-sm font-bold transition-colors cursor-pointer"
            >
              Desbloquear Configuración
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Fraunces'] text-2xl sm:text-3xl font-bold text-[#3b1e14]">
            Configuración y Sincronización
          </h1>
          <p className="text-sm text-[#6d4c41] mt-1">
            Conecta Google Sheets para sincronizar celular y laptop, o actualiza el logotipo de Alemandri.
          </p>
        </div>

        <button
          type="button"
          onClick={onLock}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#dccbc2] bg-[#fff8f5] hover:bg-[#f7eee9] text-[#3b1e14] text-xs font-semibold self-start sm:self-auto cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Bloquear sección</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
            statusMsg.ok
              ? 'bg-[#eef8f1] border-[#b9dfc5] text-[#14532d]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          {statusMsg.ok ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16a34a]" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-[#dc2626]" aria-hidden="true" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Card 1: Google Sheets Web App Integration */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#eadfd8]">
          <div>
            <h2 className="text-lg font-bold text-[#3b1e14]">
              Conexión en línea con Google Sheets
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5">
              Envía cada nuevo ítem, entrada o salida por POST en JSON y sincroniza ambos dispositivos por GET.
            </p>
          </div>
          {settings.lastSyncAt && (
            <span className="text-xs text-[#5a3b2e] tabular-nums shrink-0">
              Última sync: {formatDateTimeDisplay(settings.lastSyncAt)}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConnection} className="space-y-4">
          <div>
            <label
              htmlFor="sheets-webapp-url"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              URL de Web App de Google Apps Script
            </label>
            <input
              id="sheets-webapp-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-[#2b1811] text-sm font-mono focus:outline-none focus:border-[#f462c8] focus:ring-2 focus:ring-[#f462c8]/25"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-[#3b1e14] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="w-4 h-4 accent-[#3b1e14] rounded"
            />
            <span>
              Enviar automáticamente cada nuevo ítem, entrada o salida por POST JSON
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] text-[#fff8f5] text-sm font-semibold transition-colors cursor-pointer"
            >
              Guardar URL
            </button>

            <button
              type="button"
              disabled={isSyncing || !urlInput.trim()}
              onClick={handleSyncClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#f462c8] hover:bg-[#f77bd2] disabled:opacity-50 text-[#3b1e14] text-sm font-bold transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar ahora (GET)'}</span>
            </button>

            <button
              type="button"
              disabled={isPushing || !urlInput.trim()}
              onClick={handlePushAllClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] disabled:opacity-50 text-[#3b1e14] text-sm font-semibold transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isPushing ? 'Subiendo...' : 'Subir respaldo actual (POST)'}</span>
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-[#eadfd8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#3b1e14]">
              Carga inicial real de Alemandri
            </h3>
            <p className="text-xs text-[#6d4c41] mt-0.5">
              Limpia datos anteriores, carga el catálogo real en Bs. (42 ítems y movimientos iniciales) y sincroniza mediante <code className="font-mono">sync_full</code> separando Inventario/Movimientos de insumos y Producto Terminado/Movimientos Producto Terminado.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoadingInitial}
            onClick={handleLoadRealDataClick}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] disabled:opacity-50 text-[#fff8f5] text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <DatabaseBackup className="w-4 h-4 text-[#f462c8] shrink-0" aria-hidden="true" />
            <span>
              {isLoadingInitial
                ? 'Cargando y sincronizando...'
                : 'Cargar datos reales iniciales de Alemandri'}
            </span>
          </button>
        </div>

        <details className="pt-2 border-t border-[#eadfd8]">
          <summary className="text-xs font-semibold text-[#9d176d] cursor-pointer hover:underline select-none">
            Ver script de Google Apps Script listo para copiar y pegar
          </summary>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#6d4c41]">
                Crea una hoja en Google Sheets, abre <strong>Extensiones → Apps Script</strong>, pega este código e impleméntalo como Aplicación web (Acceso: Cualquier persona).
              </p>
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-xs font-semibold text-[#3b1e14] shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copiedCode ? 'Copiado' : 'Copiar código'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#24120c] text-[#f3e5de] text-[11px] font-mono overflow-x-auto max-h-64">
              {APPS_SCRIPT_TEMPLATE}
            </pre>
          </div>
        </details>
      </div>

      {/* Card 2: Logo Customization */}
      <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 sm:p-7 space-y-4">
        <div className="pb-3 border-b border-[#eadfd8]">
          <h2 className="text-lg font-bold text-[#3b1e14]">
            Logotipo de Alemandri
          </h2>
          <p className="text-xs text-[#6d4c41] mt-0.5">
            Se muestra en el encabezado marrón chocolate y en los reportes PDF.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="bg-[#3b1e14] rounded-xl p-4 flex items-center justify-center min-h-[76px] sm:min-w-[230px]">
            <img
              src={activeLogo}
              alt="Vista previa del logotipo Alemandri"
              referrerPolicy="no-referrer"
              className="h-12 w-auto max-w-[210px] object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#3b1e14] hover:bg-[#4e2a1d] text-[#fff8f5] text-sm font-semibold cursor-pointer transition-colors">
              <ImagePlus className="w-4 h-4 text-[#f462c8] shrink-0" aria-hidden="true" />
              <span>Cambiar logotipo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="sr-only"
              />
            </label>

            {settings.customLogoUrl && (
              <button
                type="button"
                onClick={handleResetLogo}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14] text-sm font-semibold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Restaurar original</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Protected Item Deletion */}
      <div className="bg-[#fff8f5] border border-[#f2c9c9] rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex items-start gap-3 pb-3 border-b border-[#eadfd8]">
          <div className="w-10 h-10 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#3b1e14]">
              Eliminar ítem del catálogo / inventario
            </h2>
            <p className="text-xs text-[#6d4c41] mt-0.5">
              Zona administrativa protegida. Elimina un producto o insumo de la aplicación y envía <code className="font-mono">eliminar_item</code> a Google Sheets si hay URL configurada.
            </p>
          </div>
        </div>

        {deleteFeedback && (
          <div
            role={deleteFeedback.ok ? 'status' : 'alert'}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              deleteFeedback.ok
                ? 'bg-[#eef8f1] border-[#b9dfc5] text-[#14532d]'
                : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
            }`}
          >
            {deleteFeedback.ok ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16a34a]" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-[#dc2626]" aria-hidden="true" />
            )}
            <span>{deleteFeedback.text}</span>
          </div>
        )}

        <form onSubmit={handleDeleteItemSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="delete-item-select"
              className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
            >
              Seleccionar ítem a eliminar
            </label>
            <select
              id="delete-item-select"
              value={deleteItemId}
              onChange={(e) => {
                setDeleteItemId(e.target.value);
                setDeleteFeedback(null);
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] focus:outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/20"
            >
              <option value="">-- Elige un producto o insumo ({inventory.length} registrados) --</option>
              {groupedInventory.map((group) => (
                <optgroup key={group.classification} label={group.classification}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getItemIcon(item)} {item.name} — {item.classification} (Stock:{' '}
                      {formatNumber(item.currentStock)} {item.defaultUnit})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {selectedItemToDelete && (
            <div className="p-4 rounded-xl bg-white border border-[#eadfd8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-11 h-11 rounded-xl bg-[#f7ede7] border border-[#eadfd8] flex items-center justify-center text-2xl shrink-0"
                >
                  {getItemIcon(selectedItemToDelete)}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-[#3b1e14] truncate">
                    {selectedItemToDelete.name}
                  </div>
                  <div className="text-xs text-[#6d4c41]">
                    Clasificación: {selectedItemToDelete.classification}
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-right shrink-0">
                <div className="text-[#6d4c41]">Stock actual</div>
                <div className="text-sm font-bold text-[#3b1e14] tabular-nums">
                  {formatNumber(selectedItemToDelete.currentStock)}{' '}
                  {selectedItemToDelete.defaultUnit}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label
                htmlFor="delete-secret-key"
                className="block text-sm font-semibold text-[#3b1e14] mb-1.5"
              >
                Clave secreta de confirmación
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#8c6d62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="delete-secret-key"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="off"
                  value={deleteSecretKey}
                  onChange={(e) => {
                    setDeleteSecretKey(e.target.value);
                    if (deleteFeedback && !deleteFeedback.ok) {
                      setDeleteFeedback(null);
                    }
                  }}
                  placeholder="Ingresa la clave secreta"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-[#dccbc2] text-sm text-[#2b1811] tracking-widest tabular-nums focus:outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/20"
                />
              </div>
            </div>

            <div className="sm:pt-7">
              <label className="flex items-start gap-2.5 text-xs text-[#3b1e14] cursor-pointer select-none p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#dc2626] rounded shrink-0"
                />
                <span className="font-medium leading-snug">
                  Confirmo eliminar permanentemente este ítem del catálogo e inventario.
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isDeletingItem || !selectedItemToDelete || !deleteConfirmed}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isDeletingItem
                  ? 'Eliminando ítem...'
                  : 'Eliminar ítem definitivamente'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

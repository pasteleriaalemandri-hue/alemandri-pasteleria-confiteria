import { useState } from 'react';
import { Plus, RefreshCw, Settings } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  logoUrl: string;
  isSyncing: boolean;
  onNavigate: (tab: AppTab) => void;
  onQuickEntry: () => void;
  onQuickSync: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'nuevo-item', label: 'Nuevo Ítem' },
  { id: 'entrada', label: 'Entradas' },
  { id: 'salida', label: 'Salidas' },
  { id: 'producto-final', label: 'Producto Final' },
  { id: 'configuracion', label: 'Configuración' },
];

export function Header({
  activeTab,
  logoUrl,
  isSyncing,
  onNavigate,
  onQuickEntry,
  onQuickSync,
}: HeaderProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <header className="bg-[#3b1e14] text-[#fff8f5] border-b border-[#522c1f] lg:sticky lg:top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 xl:gap-8">
        {/* Zone 1: Brand logo */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f462c8] cursor-pointer"
          aria-label="Ir al inicio de Alemandri"
        >
          {!imgFailed ? (
            <img
              key={logoUrl}
              src={logoUrl}
              alt="Alemandri — Pastelería y Confitería"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-10 sm:h-11 w-auto max-w-[150px] xl:max-w-[180px] object-contain"
            />
          ) : (
            <span className="font-['Fraunces'] text-xl sm:text-2xl font-bold tracking-tight text-[#fff8f5] whitespace-nowrap">
              Alemandri
            </span>
          )}
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegación principal"
          className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-[13px] xl:text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f462c8] ${
                  isActive
                    ? 'text-[#f462c8]'
                    : 'text-[#f3e5de] hover:text-[#fff8f5]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f462c8]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Sync button + Primary action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            disabled={isSyncing}
            onClick={onQuickSync}
            title="Actualizar datos desde Google Sheets"
            aria-label="Actualizar datos desde Google Sheets"
            className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[40px] px-2.5 rounded-lg border border-[#5a3224] bg-[#4a261a] hover:bg-[#572d1f] disabled:opacity-60 text-[#f3e5de] hover:text-[#fff8f5] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f462c8]"
          >
            <RefreshCw
              className={`w-4 h-4 text-[#f462c8] shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden xl:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('configuracion')}
            aria-label="Configuración"
            className={`lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
              activeTab === 'configuracion'
                ? 'bg-[#522c1f] text-[#f462c8]'
                : 'text-[#f3e5de] hover:bg-[#4e2a1d]'
            }`}
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onQuickEntry}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[40px] rounded-lg bg-[#f462c8] hover:bg-[#f77bd2] active:scale-[0.98] text-[#3b1e14] text-xs xl:text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff8f5]"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Registrar Compra</span>
            <span className="sm:hidden">Compra</span>
          </button>
        </div>
      </div>
    </header>
  );
}

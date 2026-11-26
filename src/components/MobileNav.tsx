import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CakeSlice,
  LayoutDashboard,
  Package,
  PlusCircle,
} from 'lucide-react';
import { AppTab } from '../types';

interface MobileNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
}

const MOBILE_TABS: {
  id: AppTab;
  label: string;
  Icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Panel', Icon: LayoutDashboard },
  { id: 'catalogo', label: 'Catálogo', Icon: BookOpen },
  { id: 'inventario', label: 'Stock', Icon: Package },
  { id: 'nuevo-item', label: 'Nuevo', Icon: PlusCircle },
  { id: 'entrada', label: 'Entradas', Icon: ArrowDownToLine },
  { id: 'salida', label: 'Salidas', Icon: ArrowUpFromLine },
  { id: 'producto-final', label: 'Final', Icon: CakeSlice },
];

export function MobileNav({ activeTab, onNavigate }: MobileNavProps) {
  return (
    <nav
      aria-label="Navegación móvil"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#3b1e14]/95 backdrop-blur-md border-t border-[#522c1f] text-[#f3e5de]"
    >
      <div className="grid grid-cols-7 h-16">
        {MOBILE_TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center min-h-[44px] px-0.5 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#f462c8] ${
                isActive ? 'text-[#f462c8]' : 'text-[#e5d2c7] hover:text-[#fff8f5]'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-medium mt-1 whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

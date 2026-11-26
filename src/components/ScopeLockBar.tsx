import { Lock, Unlock } from 'lucide-react';
import { ScopeMode } from '../types';

interface ScopeLockBarProps {
  scope: ScopeMode;
  isLocked: boolean;
  onScopeChange: (next: ScopeMode) => void;
  onToggleLock: () => void;
  label?: string;
}

const SCOPE_OPTIONS: { id: ScopeMode; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'insumos', label: 'Solo Insumos en general' },
  { id: 'producto-final', label: 'Solo Producto Terminado' },
];

export function ScopeLockBar({
  scope,
  isLocked,
  onScopeChange,
  onToggleLock,
  label = 'Alcance:',
}: ScopeLockBarProps) {
  return (
    <div className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-3.5 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#5a3b2e] mr-1">
          {label}
        </span>

        <div
          role="group"
          aria-label="Selector de alcance bloqueable"
          className="inline-flex flex-wrap p-1 rounded-xl bg-[#efe5df] border border-[#eadfd8] gap-1"
        >
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.id;
            const disabled = isLocked && !active;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onScopeChange(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#3b1e14] text-[#fff8f5]'
                    : disabled
                    ? 'text-[#9e867c] opacity-55 cursor-not-allowed'
                    : 'text-[#5a3b2e] hover:text-[#3b1e14] cursor-pointer'
                }`}
              >
                {active && isLocked && (
                  <Lock className="w-3.5 h-3.5 text-[#f462c8] shrink-0" aria-hidden="true" />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-pressed={isLocked}
        onClick={onToggleLock}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap self-start md:self-auto transition-colors cursor-pointer ${
          isLocked
            ? 'bg-[#f462c8] hover:bg-[#f77bd2] text-[#3b1e14]'
            : 'border border-[#dccbc2] bg-white hover:bg-[#f7eee9] text-[#3b1e14]'
        }`}
      >
        {isLocked ? (
          <>
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Filtro bloqueado (Desbloquear)</span>
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Bloquear alcance</span>
          </>
        )}
      </button>
    </div>
  );
}

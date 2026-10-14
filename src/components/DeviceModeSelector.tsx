import React from 'react';
import { DeviceViewMode, AppNavigationMode } from '../types/inventory';
import {
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Package,
  MapPin,
  Database,
} from 'lucide-react';

interface DeviceModeSelectorProps {
  deviceMode: DeviceViewMode;
  onChangeMode: (mode: DeviceViewMode) => void;
  activeAppMode: AppNavigationMode;
  onSwitchAppMode: (mode: AppNavigationMode) => void;
  itemCount: number;
  locationCount: number;
  masterProductCount?: number;
}

export const DeviceModeSelector: React.FC<DeviceModeSelectorProps> = ({
  deviceMode,
  onChangeMode,
  activeAppMode,
  onSwitchAppMode,
  itemCount,
  locationCount,
  masterProductCount = 0,
}) => {
  return (
    <div className="w-full bg-neutral-900 text-neutral-200 border-b border-neutral-800 text-xs select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Device Switcher Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
            <span>Tampilan Layar:</span>
          </span>

          <div className="inline-flex items-center bg-neutral-800/90 p-1 rounded-xl border border-neutral-700/80 shadow-inner">
            {/* 1. Responsif / Auto (DEFAULT BARU SESUAI PERMINTAAN USER) */}
            <button
              type="button"
              onClick={() => onChangeMode('auto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceMode === 'auto'
                  ? 'bg-emerald-600 text-white shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
              title="Tampilan Responsif Otomatis Mengikuti Layar Device yang Digunakan (Default)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Responsif</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  deviceMode === 'auto'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-700 text-neutral-300'
                }`}
              >
                Default
              </span>
            </button>

            {/* 2. Mobile (HP) */}
            <button
              type="button"
              onClick={() => onChangeMode('mobile')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-[#b8126f] text-white shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
              title="Simulasi Tampilan Layar HP Mobile"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>HP Mobile</span>
            </button>

            {/* 3. Tablet */}
            <button
              type="button"
              onClick={() => onChangeMode('tablet')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-blue-600 text-white shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
              title="Simulasi Tampilan Layar Tablet / iPad (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>

            {/* 4. Desktop */}
            <button
              type="button"
              onClick={() => onChangeMode('desktop')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-indigo-600 text-white shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
              title="Simulasi Tampilan Layar Komputer / Desktop"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-neutral-400 hidden lg:inline">Menu Aktif:</span>
          <div className="inline-flex items-center bg-neutral-800 p-0.5 rounded-lg border border-neutral-700">
            <button
              type="button"
              onClick={() => onSwitchAppMode('RETURN')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                activeAppMode === 'RETURN'
                  ? 'bg-neutral-700 text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Package className="w-3 h-3 text-[#f472b6]" />
              <span>Retur ({itemCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchAppMode('STORAGE')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                activeAppMode === 'STORAGE'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <MapPin className="w-3 h-3 text-blue-300" />
              <span>Lokasi ({locationCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchAppMode('DATABASE')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                activeAppMode === 'DATABASE'
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Database ({masterProductCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

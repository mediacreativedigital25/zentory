import type { ReactNode } from 'react';
import { 
  BarChart3, 
  Settings, 
  Users, 
  LayoutDashboard, 
  Bell, 
  Box, 
  LogOut,
  Hexagon 
} from 'lucide-react';

export function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 hidden md:flex text-slate-300 font-sans">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Hexagon className="w-6 h-6 text-indigo-500 fill-indigo-500/20 mr-3" />
        <span className="text-lg font-semibold text-white tracking-tight">Zyvora</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 px-3">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-500 tracking-wider uppercase">Main</div>
        <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active />
        <NavItem icon={<BarChart3 size={18} />} label="Analytics" />
        <NavItem icon={<Users size={18} />} label="Customers" />
        <NavItem icon={<Box size={18} />} label="Products" />
        
        <div className="px-3 mt-6 mb-2 text-xs font-semibold text-slate-500 tracking-wider uppercase">System</div>
        <NavItem icon={<Bell size={18} />} label="Notifications" badge="3" />
        <NavItem icon={<Settings size={18} />} label="Settings" />
      </div>

      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, badge }: { icon: ReactNode, label: string, active?: boolean, badge?: string }) {
  return (
    <button className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
    }`}>
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge && (
        <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

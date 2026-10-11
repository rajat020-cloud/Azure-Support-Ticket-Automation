import React from 'react';
import {
  LayoutDashboard,
  PlusSquare,
  ListFilter,
  BarChart3,
  FileCode2,
  Cloud,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'new-ticket' | 'tickets' | 'evaluation' | 'api-docs';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'new-ticket', label: 'New Ticket', icon: <PlusSquare className="w-5 h-5" /> },
    { id: 'tickets', label: 'All Tickets', icon: <ListFilter className="w-5 h-5" /> },
    { id: 'evaluation', label: 'Evaluation', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'api-docs', label: 'API Docs', icon: <FileCode2 className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-[#0d1326] text-slate-200 flex flex-col justify-between shrink-0 min-h-screen select-none border-r border-slate-800">
      <div>
        {/* Brand Header */}
        <div className="px-6 py-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-snug">
              Azure Support
            </h1>
            <p className="text-xs text-slate-400 font-medium">Ticket Automation</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-5 space-y-1.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Operations Card */}
      <div className="p-4">
        <div className="rounded-2xl bg-gradient-to-br from-slate-800/90 to-indigo-950/80 p-4 border border-slate-700/60">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">AI-Assisted</p>
              <p className="text-[11px] text-slate-400">Support Operations</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Classify &bull; Prioritize &bull; Assist &bull; Review &bull; Resolve
          </p>
        </div>
      </div>
    </aside>
  );
};

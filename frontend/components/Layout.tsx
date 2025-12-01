import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, Users, PenTool, LayoutDashboard, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children?: React.ReactNode;
  user: User;
  onLogout: () => void;
  title: string;
}

export default function Layout({ children, user, onLogout, title }: LayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="text-brand-500" />
            SignFlow
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{user.role} Portal</p>
        </div>

        <nav className="p-4 space-y-2">
          {user.role === UserRole.ADMIN && (
            <>
              <button 
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg text-brand-400 font-medium"
              >
                <Users size={20} /> Agents & Docs
              </button>
            </>
          )}

          {user.role === UserRole.AGENT && (
            <>
              <button 
                onClick={() => navigate('/agent')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-lg text-brand-400 font-medium"
              >
                <LayoutDashboard size={20} /> Dashboard
              </button>
            </>
          )}

          <div className="pt-8 mt-8 border-t border-slate-700">
             <div className="px-4 mb-4">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
             </div>
             <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Switch between Admin and Agent views"
              >
                <RefreshCw size={18} /> Switch Role (Dev)
              </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">Secure Environment</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
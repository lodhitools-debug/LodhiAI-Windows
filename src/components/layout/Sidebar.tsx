import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Code2,
  FolderGit2,
  Bot,
  FileText,
  Database,
  Cpu,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { NavScreen } from '../../types';
import { Badge } from '../common/Badge';

interface NavItemDef {
  id: NavScreen;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  phaseBadge?: string;
}

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen, sidebarCollapsed, setSidebarCollapsed, edition } = useApp();

  const navItems: NavItemDef[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'chat', label: 'AI Chat', icon: <MessageSquare size={18} />, badge: 'Ready' },
    { id: 'code', label: 'AI Coding Agent', icon: <Code2 size={18} />, badge: 'Active' },
    { id: 'workspace', label: 'Project Workspace', icon: <FolderGit2 size={18} />, badge: 'Active' },
    { id: 'agents', label: 'Automation Agents', icon: <Bot size={18} />, phaseBadge: 'P4' },
    { id: 'documents', label: 'Documents & Files', icon: <FileText size={18} />, phaseBadge: 'P3' },
    { id: 'knowledge', label: 'Knowledge Base', icon: <Database size={18} />, phaseBadge: 'P3' },
    { id: 'models', label: 'Model Providers', icon: <Cpu size={18} />, phaseBadge: 'P2' },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
    { id: 'diagnostics', label: 'Diagnostics & Logs', icon: <Activity size={18} /> },
  ];

  return (
    <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar header toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {!sidebarCollapsed && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Navigation
          </span>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '6px',
            color: '#94a3b8',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation list */}
      <nav className="sidebar-nav">
        {navItems.map(item => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
              aria-label={item.id === 'code' ? 'AI Coding Agent & Coding Assistant' : undefined}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {!sidebarCollapsed && (
                <>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <Badge variant="teal" size="sm">
                      {item.badge}
                    </Badge>
                  )}
                  {item.phaseBadge && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {item.phaseBadge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: Edition & Privacy Indicator */}
      {!sidebarCollapsed ? (
        <div
          style={{
            padding: '14px',
            margin: '8px',
            borderRadius: '10px',
            backgroundColor: 'rgba(17, 29, 61, 0.6)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase' }}>
              {edition} Edition
            </span>
            <Badge variant="blue" size="sm">
              <Zap size={10} style={{ marginRight: '3px' }} />
              Active
            </Badge>
          </div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
            Zero external data transfer. Local sandbox guard active.
          </p>
        </div>
      ) : (
        <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
          <div
            title={`${edition.toUpperCase()} Edition - Local Sandbox Active`}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8',
            }}
          />
        </div>
      )}
    </aside>
  );
};

import React from 'react';
import {
  MessageSquare,
  Code2,
  FolderGit2,
  Bot,
  Activity,
  Cpu,
  ShieldCheck,
  HardDrive,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const DashboardScreen: React.FC = () => {
  const { setActiveScreen, edition, setEdition, systemInfo, isTauri } = useApp();

  const quickLaunchItems = [
    {
      title: 'AI Chat',
      desc: 'Interactive chat shell with multi-session history, local Ollama streaming, and native DPAPI secret vault.',
      icon: <MessageSquare size={20} color="#38bdf8" />,
      screen: 'chat' as const,
      badge: 'Active Local / Cloud',
      badgeVariant: 'teal' as const,
    },
    {
      title: 'Coding Assistant',
      desc: 'Polyglot code generation, staged diff review, recoverable backups, and 12-step verified safety workflow.',
      icon: <Code2 size={20} color="#818cf8" />,
      screen: 'code' as const,
      badge: 'Verified Safe',
      badgeVariant: 'teal' as const,
    },
    {
      title: 'Project Workspaces',
      desc: 'Local directory sandboxing, file tree exploration, direct editing with rollback, and symbol search.',
      icon: <FolderGit2 size={20} color="#2dd4bf" />,
      screen: 'workspace' as const,
      badge: 'Sandboxed Active',
      badgeVariant: 'teal' as const,
    },
    {
      title: 'Automation Agents',
      desc: 'Autonomous developer tools, approved app allowlist, action preview, and clipboard audit logging.',
      icon: <Bot size={20} color="#fbbf24" />,
      screen: 'agents' as const,
      badge: 'Least-Privilege Guard',
      badgeVariant: 'blue' as const,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Hero Welcome Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '28px 32px',
          background: 'linear-gradient(135deg, rgba(11, 19, 41, 0.95) 0%, rgba(17, 29, 61, 0.75) 50%, rgba(7, 11, 20, 0.9) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Badge variant="blue" size="md">
                Commercial AI Desktop Platform
              </Badge>
              <Badge variant="teal" size="md" dot>
                Windows Release v0.1.0
              </Badge>
            </div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '8px',
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Lodhi AI — Think • Create • Automate
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              Engineered for Windows developers, freelancers, students, and businesses.
              Experience local sandbox isolation, an 8 GB RAM target footprint, and zero cloud data leaks.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Button
              variant="primary"
              size="lg"
              icon={<MessageSquare size={16} />}
              onClick={() => setActiveScreen('chat')}
            >
              Launch Chat
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Activity size={16} />}
              onClick={() => setActiveScreen('diagnostics')}
            >
              View Diagnostics
            </Button>
          </div>
        </div>
      </div>

      {/* Hardware & Sandbox Specifications Widget */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <Card
          title="Hardware Footprint"
          subtitle="Target PC Architecture"
          action={<HardDrive size={18} color="#38bdf8" />}
        >
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
              8 GB RAM Target
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Optimized for Windows 10 & 11 without background bloatware.
            </div>
          </div>
        </Card>

        <Card
          title="Security Sandbox"
          subtitle="Least-Privilege Model"
          action={<ShieldCheck size={18} color="#2dd4bf" />}
        >
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2dd4bf' }}>
              Zero Egress
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Local offline sandbox by default; cloud requests require opt-in consent and DPAPI encryption.
            </div>
          </div>
        </Card>

        <Card
          title="Desktop Core"
          subtitle="Native Desktop Foundation"
          action={<Cpu size={18} color="#818cf8" />}
        >
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#818cf8' }}>
              {isTauri ? 'Tauri 2 / Rust' : 'Vite Desktop Core'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {systemInfo?.os || 'Windows Desktop Environment'}
            </div>
          </div>
        </Card>

        <Card
          title="Active Edition"
          subtitle="Tier Capabilities"
          action={<Sparkles size={18} color="#fbbf24" />}
        >
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
              {edition} Tier
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Switchable preview in settings or top bar.
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginBottom: '14px' }}>
          Explore Platform Modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {quickLaunchItems.map((item, idx) => (
            <div
              key={idx}
              className="glass-panel"
              onClick={() => setActiveScreen(item.screen)}
              style={{
                padding: '18px 20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>
                  <Badge variant={item.badgeVariant} size="sm">
                    {item.badge}
                  </Badge>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: 500, marginTop: '16px' }}>
                <span>Launch screen</span>
                <ArrowRight size={13} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Edition Breakdown */}
      <Card
        title="Commercial Editions Overview"
        subtitle="Tier selection is a preview only; these are roadmap capabilities, not paid entitlements."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
          {/* Free Edition */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: edition === 'free' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(7, 11, 20, 0.5)',
              border: `1px solid ${edition === 'free' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#f8fafc' }}>Free Edition</h4>
              <Badge variant={edition === 'free' ? 'blue' : 'neutral'} size="sm">
                {edition === 'free' ? 'Selected' : 'Free Forever'}
              </Badge>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
              Current desktop shell with local Ollama chat and Google Gemini integration with user-provided API key.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['Local Ollama & Google Gemini chat', 'On-device conversation history', 'Dashboard and diagnostics', 'LM Studio and document tools planned'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                  <CheckCircle2 size={13} color="#38bdf8" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {edition !== 'free' && (
              <Button variant="outline" size="sm" style={{ width: '100%', marginTop: '14px' }} onClick={() => setEdition('free')}>
                Select Free Tier
              </Button>
            )}
          </div>

          {/* Pro Edition */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: edition === 'pro' ? 'rgba(129, 140, 248, 0.1)' : 'rgba(7, 11, 20, 0.5)',
              border: `1px solid ${edition === 'pro' ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#f8fafc' }}>Pro Edition</h4>
              <Badge variant={edition === 'pro' ? 'purple' : 'neutral'} size="sm">
                {edition === 'pro' ? 'Selected' : 'Pro Tier'}
              </Badge>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
              Preview only. No paid subscriptions, commercial cloud gateways, or Pro entitlements are active in this build.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['Cloud provider integration · planned', 'Multi-step agents · planned', 'Advanced coding tools · planned', 'Workspace expansions · planned'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                  <CheckCircle2 size={13} color="#818cf8" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {edition !== 'pro' && (
              <Button variant="outline" size="sm" style={{ width: '100%', marginTop: '14px' }} onClick={() => setEdition('pro')}>
                Select Pro Tier
              </Button>
            )}
          </div>

          {/* Business Edition */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: edition === 'business' ? 'rgba(45, 212, 191, 0.1)' : 'rgba(7, 11, 20, 0.5)',
              border: `1px solid ${edition === 'business' ? 'rgba(45, 212, 191, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#f8fafc' }}>Business Edition</h4>
              <Badge variant={edition === 'business' ? 'teal' : 'neutral'} size="sm">
                {edition === 'business' ? 'Selected' : 'Business Tier'}
              </Badge>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
              Preview only. Business governance and enterprise services are not implemented in this build.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {['Centralized knowledge vault · planned', 'Governance tools · planned', 'Inference gateway · planned', 'Access management · planned'].map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                  <CheckCircle2 size={13} color="#2dd4bf" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {edition !== 'business' && (
              <Button variant="outline" size="sm" style={{ width: '100%', marginTop: '14px' }} onClick={() => setEdition('business')}>
                Select Business Tier
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

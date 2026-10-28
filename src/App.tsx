import React from 'react';
import { useApp } from './store/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardScreen } from './screens/DashboardScreen';
import { ChatScreen } from './screens/ChatScreen';
import { CodingAssistantScreen } from './screens/CodingAssistantScreen';
import { ProjectWorkspaceScreen } from './screens/ProjectWorkspaceScreen';
import { AutomationAgentsScreen } from './screens/AutomationAgentsScreen';
import { DocumentsScreen } from './screens/DocumentsScreen';
import { KnowledgeBaseScreen } from './screens/KnowledgeBaseScreen';
import { ModelSettingsScreen } from './screens/ModelSettingsScreen';
import { GeneralSettingsScreen } from './screens/GeneralSettingsScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  const { activeScreen, setActiveScreen } = useApp();

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'chat':
        return <ChatScreen />;
      case 'code':
        return <CodingAssistantScreen />;
      case 'workspace':
        return <ProjectWorkspaceScreen />;
      case 'agents':
        return <AutomationAgentsScreen />;
      case 'documents':
        return <DocumentsScreen />;
      case 'knowledge':
        return <KnowledgeBaseScreen />;
      case 'models':
        return <ModelSettingsScreen />;
      case 'settings':
        return <GeneralSettingsScreen />;
      case 'diagnostics':
        return <DiagnosticsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <AppLayout>
      <ErrorBoundary onReset={() => setActiveScreen('dashboard')}>
        {renderActiveScreen()}
      </ErrorBoundary>
    </AppLayout>
  );
};

export default App;

import React from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="app-container">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content animate-fade-in">
          {children}
        </main>
      </div>
      <StatusBar />
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { SiteFooter, TopHeader } from './components/BrandMotifs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { OwnerDashboard } from './components/OwnerDashboard';
import { SurveyWizard } from './components/SurveyWizard';
import { SiteContentProvider } from './context/SiteContentContext';
import { playPageTransition } from './utils/soundEngine';

type AppView = 'landing' | 'survey' | 'admin';

function resolveInitialView(): AppView {
  if (typeof window === 'undefined') return 'landing';
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'admin' || window.location.hash === '#admin') {
    return 'admin';
  }
  if (params.get('autostart') === '1') {
    return 'survey';
  }
  return 'landing';
}

export default function App() {
  const [view, setView] = useState<AppView>(resolveInitialView);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#admin') {
        setView('admin');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = (nextView: AppView) => {
    if (nextView === view) return;
    playPageTransition(nextView === 'landing' ? 'back' : 'forward');
    setView(nextView);
    if (nextView === 'admin') {
      window.history.replaceState(null, '', '?view=admin');
    } else if (nextView === 'survey') {
      window.history.replaceState(null, '', '?autostart=1');
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ErrorBoundary>
      <SiteContentProvider>
        <div className="min-h-screen flex flex-col bg-[#F7F1E3] text-[#173E2C]">
          <TopHeader
            mode={view}
            onNavigateHome={() => navigateTo('landing')}
            onStartSurvey={() => navigateTo('survey')}
          />

          <div className="flex-1">
            <div key={view} className="mashro-page-enter">
              {view === 'landing' && (
                <LandingPage onStartSurvey={() => navigateTo('survey')} />
              )}
              {view === 'survey' && (
                <SurveyWizard onReturnHome={() => navigateTo('landing')} />
              )}
              {view === 'admin' && (
                <OwnerDashboard onNavigateHome={() => navigateTo('landing')} />
              )}
            </div>
          </div>

          <SiteFooter onOpenAdmin={() => navigateTo('admin')} />
        </div>
      </SiteContentProvider>
    </ErrorBoundary>
  );
}

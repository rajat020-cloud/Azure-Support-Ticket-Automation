import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, KeyRound, LogIn, LogOut, Moon, Sun } from 'lucide-react';
import { Sidebar, NavTab } from './components/Sidebar';
import { TicketDetailPanel } from './components/TicketDetailPanel';
import { AuthModal } from './components/AuthModal';
import { DashboardPage } from './pages/DashboardPage';
import { NewTicketPage } from './pages/NewTicketPage';
import { TicketListPage } from './pages/TicketListPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { AuthUser, DashboardMetricsResponse, Ticket } from './types/ticket';
import { apiClient, ApiClientError } from './services/api';

const TOKEN_STORAGE_KEY = 'ps04_reviewer_token';
const USER_STORAGE_KEY = 'ps04_reviewer_user';
const THEME_STORAGE_KEY = 'ps04_theme_mode';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reviewerApiKey, setReviewerApiKey] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reviewer Login / Sign-Up State
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Ctrl+K / Cmd+K shortcut to focus global ticket search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchDashboardMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await apiClient.getMetrics();
      setMetrics(data);
      setSelectedTicket((prev) => {
        if (prev) {
          const updatedInRecent = data.recentTickets.find(
            (t) => t.ticketId === prev.ticketId
          );
          return updatedInRecent || prev;
        }
        return data.recentTickets[0] || null;
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setMetricsError(err.message);
      } else {
        setMetricsError('Unable to load dashboard metrics from the backend.');
      }
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  const handleAuthenticated = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const handleTicketCreated = (newTicket: Ticket) => {
    setSelectedTicket(newTicket);
    setRefreshTrigger((n) => n + 1);
    fetchDashboardMetrics();
  };

  const handleTicketUpdated = (updatedTicket: Ticket) => {
    setSelectedTicket(updatedTicket);
    setRefreshTrigger((n) => n + 1);
    fetchDashboardMetrics();
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveTab('tickets');
  };

  const showDetailPanel =
    activeTab === 'dashboard' || activeTab === 'new-ticket' || activeTab === 'tickets';

  const userInitials = authUser?.name
    ? authUser.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SR';

  return (
    <div
      className={`min-h-screen flex ${
        darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Left Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Center + Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0">
          <form onSubmit={handleGlobalSearchSubmit} className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Global ticket search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search tickets by ID, message, or keyword..."
              className="w-full pl-9 pr-16 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
              Ctrl K
            </span>
          </form>

          {/* Right Reviewer Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Toggle theme"
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Toggle Contrast Mode"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
            </button>

            {!authToken && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <input
                  type="password"
                  aria-label="Topbar reviewer key"
                  value={reviewerApiKey}
                  onChange={(e) => setReviewerApiKey(e.target.value)}
                  placeholder="Reviewer API Key..."
                  className="bg-transparent text-xs text-slate-700 w-32 focus:outline-none"
                />
              </div>
            )}

            {authUser ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  {userInitials}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-bold text-slate-800">{authUser.name}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    {authUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Sign Up</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Workspace Split: Page View + Ticket Detail Drawer */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <main className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <DashboardPage
                metrics={metrics}
                loading={metricsLoading}
                error={metricsError}
                selectedTicketId={selectedTicket?.ticketId ?? null}
                onSelectTicket={(t) => setSelectedTicket(t)}
                onNavigate={setActiveTab}
                onRefresh={fetchDashboardMetrics}
              />
            )}

            {activeTab === 'new-ticket' && (
              <NewTicketPage onTicketCreated={handleTicketCreated} />
            )}

            {activeTab === 'tickets' && (
              <TicketListPage
                selectedTicketId={selectedTicket?.ticketId ?? null}
                onSelectTicket={(t) => setSelectedTicket(t)}
                externalSearch={globalSearch}
                refreshTrigger={refreshTrigger}
              />
            )}

            {activeTab === 'evaluation' && (
              <EvaluationPage reviewerApiKey={authToken || reviewerApiKey} />
            )}

            {activeTab === 'api-docs' && <ApiDocsPage />}
          </main>

          {showDetailPanel && (
            <TicketDetailPanel
              ticket={selectedTicket}
              reviewerApiKey={reviewerApiKey}
              onReviewerApiKeyChange={setReviewerApiKey}
              authUser={authUser}
              authToken={authToken}
              onTicketUpdated={handleTicketUpdated}
            />
          )}
        </div>
      </div>

      {/* Reviewer Login / Sign-Up Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
};

export default App;

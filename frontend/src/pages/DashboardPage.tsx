import React from 'react';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  DashboardMetricsResponse,
  Ticket,
  TicketCategory,
  TicketPriority,
} from '../types/ticket';
import { CategoryBadge, PriorityBadge, ReviewStatusBadge } from '../components/Badge';
import { NavTab } from '../components/Sidebar';

interface DashboardPageProps {
  metrics: DashboardMetricsResponse | null;
  loading: boolean;
  error: string | null;
  selectedTicketId: string | null;
  onSelectTicket: (ticket: Ticket) => void;
  onNavigate: (tab: NavTab) => void;
  onRefresh: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  loading,
  error,
  selectedTicketId,
  onSelectTicket,
  onNavigate,
  onRefresh,
}) => {
  const total = metrics?.totalTickets ?? 0;
  const pendingCount = metrics?.byReviewStatus?.pending_review ?? 0;
  const needsReviewCount = metrics?.byReviewStatus?.needs_review ?? 0;
  const approvedCount = metrics?.byReviewStatus?.approved ?? 0;

  const categories: Array<{
    name: TicketCategory;
    color: string;
    stroke: string;
  }> = [
    { name: 'Technical', color: 'bg-blue-500', stroke: '#3b82f6' },
    { name: 'Billing', color: 'bg-violet-500', stroke: '#8b5cf6' },
    { name: 'Access', color: 'bg-emerald-500', stroke: '#10b981' },
    { name: 'General', color: 'bg-amber-500', stroke: '#f59e0b' },
  ];

  const priorities: Array<{
    name: TicketPriority;
    barClass: string;
  }> = [
    { name: 'Low', barClass: 'bg-emerald-500' },
    { name: 'Medium', barClass: 'bg-blue-600' },
    { name: 'High', barClass: 'bg-amber-500' },
    { name: 'Critical', barClass: 'bg-rose-500' },
  ];

  const maxPriorityCount = Math.max(
    1,
    ...priorities.map((p) => metrics?.byPriority?.[p.name] ?? 0)
  );

  // Build SVG Donut segments
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50 via-blue-50 to-violet-100 border border-indigo-100 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl space-y-2.5">
          <p className="text-xs font-bold tracking-widest uppercase text-indigo-600">
            Welcome to
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Azure Support Ticket Automation
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            AI-assisted classification, prioritization and draft responses for faster, smarter and more consistent support operations.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('new-ticket')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Support Ticket</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold shadow-sm transition-all"
            >
              <span>View All Tickets</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-600 border border-slate-200 text-xs font-medium transition-all"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Right visual accent */}
        <div className="hidden xl:flex items-center justify-center pr-4">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-indigo-500/25 flex flex-col items-center justify-center text-white p-4 text-center">
            <span className="text-2xl font-black">PS04</span>
            <span className="text-[11px] text-blue-100 mt-1 font-medium">
              Human-in-the-Loop Triage Engine
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="font-semibold underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Total Tickets</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading && !metrics ? '...' : total}
            </span>
            <span className="text-[11px] text-slate-400">Live MongoDB count</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Pending Review</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading && !metrics ? '...' : pendingCount}
            </span>
            <span className="text-[11px] text-amber-600 font-medium">
              Awaiting sign-off
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Needs Review</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading && !metrics ? '...' : needsReviewCount}
            </span>
            <span className="text-[11px] text-rose-600 font-medium">
              Manual triage required
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Approved</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading && !metrics ? '...' : approvedCount}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              Human verified
            </span>
          </div>
        </div>
      </div>

      {/* Category & Priority Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets by Category Donut */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Tickets by Category</h2>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="16"
                />
                {total > 0 &&
                  categories.map((cat) => {
                    const count = metrics?.byCategory?.[cat.name] ?? 0;
                    const pct = count / total;
                    const strokeDasharray = `${pct * circumference} ${circumference}`;
                    const strokeDashoffset = -cumulativePercent * circumference;
                    cumulativePercent += pct;
                    return (
                      <circle
                        key={cat.name}
                        cx="64"
                        cy="64"
                        r={radius}
                        fill="transparent"
                        stroke={cat.stroke}
                        strokeWidth="16"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                  })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">{total}</span>
                <span className="text-[11px] text-slate-500 font-medium">Total</span>
              </div>
            </div>

            <div className="space-y-2.5 w-full sm:w-52">
              {categories.map((cat) => {
                const count = metrics?.byCategory?.[cat.name] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                      <span className="text-slate-700 font-medium">{cat.name}</span>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {count}{' '}
                      <span className="text-slate-400 font-normal">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tickets by Priority Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Tickets by Priority</h2>
          <div className="h-40 flex items-end justify-around gap-4 pt-6 px-2 border-b border-slate-100">
            {priorities.map((prio) => {
              const count = metrics?.byPriority?.[prio.name] ?? 0;
              const heightPct = total > 0 ? Math.max(10, Math.round((count / maxPriorityCount) * 100)) : 8;
              return (
                <div
                  key={prio.name}
                  className="flex flex-col items-center flex-1 h-full justify-end"
                >
                  <span className="text-xs font-bold text-slate-700 mb-1">{count}</span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[48px] rounded-t-lg transition-all ${prio.barClass}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-around pt-2 text-xs text-slate-600 font-medium">
            {priorities.map((prio) => (
              <span key={prio.name} className="flex-1 text-center">
                {prio.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Support Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Support Tickets</h2>
          <button
            type="button"
            onClick={() => onNavigate('tickets')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!metrics?.recentTickets || metrics.recentTickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No support tickets have been created yet. Click{' '}
            <button
              type="button"
              onClick={() => onNavigate('new-ticket')}
              className="text-indigo-600 font-semibold underline"
            >
              New Support Ticket
            </button>{' '}
            to submit and classify your first ticket.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Team</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {metrics.recentTickets.map((t) => {
                  const isSelected = selectedTicketId === t.ticketId;
                  return (
                    <tr
                      key={t.ticketId}
                      onClick={() => onSelectTicket(t)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {t.ticketId}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[220px] truncate">
                        {t.message}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <CategoryBadge category={t.category} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {t.assignedTeam}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ReviewStatusBadge status={t.reviewStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicket(t);
                          }}
                          aria-label={`Inspect ${t.ticketId}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

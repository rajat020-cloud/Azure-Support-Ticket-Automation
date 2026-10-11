import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  PaginationMetadata,
  ReviewStatus,
  Ticket,
  TicketCategory,
  TicketPriority,
} from '../types/ticket';
import { apiClient, ApiClientError } from '../services/api';
import { CategoryBadge, PriorityBadge, ReviewStatusBadge } from '../components/Badge';

interface TicketListPageProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticket: Ticket) => void;
  externalSearch: string;
  refreshTrigger: number;
}

export const TicketListPage: React.FC<TicketListPageProps> = ({
  selectedTicketId,
  onSelectTicket,
  externalSearch,
  refreshTrigger,
}) => {
  const [search, setSearch] = useState(externalSearch);
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | ''>('');
  const [sortOption, setSortOption] = useState<
    'createdAt:desc' | 'confidence:desc' | 'confidence:asc' | 'ticketId:asc'
  >('createdAt:desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(8);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 8,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(externalSearch);
    setPage(1);
  }, [externalSearch]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sortBy, sortOrder] = sortOption.split(':') as [
      'createdAt' | 'ticketId' | 'priority' | 'confidence',
      'asc' | 'desc'
    ];
    try {
      const response = await apiClient.listTickets({
        page,
        limit,
        search,
        category,
        priority,
        reviewStatus,
        sortBy,
        sortOrder,
      });
      setTickets(response.tickets);
      setPagination(response.pagination);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load support tickets.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, category, priority, reviewStatus, sortOption]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets, refreshTrigger]);

  const handleExportCsv = () => {
    if (tickets.length === 0) return;
    const headers = [
      'Ticket ID',
      'Category',
      'Priority',
      'Assigned Team',
      'Confidence',
      'Review Status',
      'Target SLA',
      'Created At',
      'Approved By',
      'Customer Message',
    ];
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = tickets.map((t) =>
      [
        escapeCsv(t.ticketId),
        escapeCsv(t.category),
        escapeCsv(t.priority),
        escapeCsv(t.assignedTeam),
        t.confidence.toFixed(2),
        escapeCsv(t.reviewStatus),
        escapeCsv(t.slaTarget?.label || ''),
        escapeCsv(new Date(t.createdAt).toISOString()),
        escapeCsv(t.approvalMetadata?.approvedBy || ''),
        escapeCsv(t.message),
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `azure-support-tickets-page-${page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const quickStatusPills: Array<{ label: string; value: ReviewStatus | '' }> = [
    { label: 'All Queues', value: '' },
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Needs Manual Triage', value: 'needs_review' },
    { label: 'Approved', value: 'approved' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">All Support Tickets</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Search, filter, sort, export, and inspect classified tickets persisted in MongoDB.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={tickets.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={fetchTickets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh List</span>
          </button>
        </div>
      </div>

      {/* Quick Filter Status Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {quickStatusPills.map((pill) => {
          const active = reviewStatus === pill.value;
          return (
            <button
              key={pill.label}
              type="button"
              onClick={() => {
                setReviewStatus(pill.value);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Filters, Search & Sort Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search tickets"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Ticket ID, message, or team..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as TicketCategory | '');
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          <option value="Billing">Billing</option>
          <option value="Technical">Technical</option>
          <option value="Access">Access</option>
          <option value="General">General</option>
        </select>

        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as TicketPriority | '');
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <select
          aria-label="Filter by review status"
          value={reviewStatus}
          onChange={(e) => {
            setReviewStatus(e.target.value as ReviewStatus | '');
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Review Statuses</option>
          <option value="pending_review">Pending Review</option>
          <option value="needs_review">Needs Review</option>
          <option value="approved">Approved</option>
        </select>

        <select
          aria-label="Sort tickets"
          value={sortOption}
          onChange={(e) => {
            setSortOption(
              e.target.value as
                | 'createdAt:desc'
                | 'confidence:desc'
                | 'confidence:asc'
                | 'ticketId:asc'
            );
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="createdAt:desc">Sort: Newest First</option>
          <option value="confidence:desc">Sort: Highest Confidence</option>
          <option value="confidence:asc">Sort: Lowest Confidence</option>
          <option value="ticketId:asc">Sort: Ticket ID (A–Z)</option>
        </select>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Loading support tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No tickets match the current search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3.5 px-4">Ticket ID</th>
                  <th className="py-3.5 px-4">Message</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Assigned Team</th>
                  <th className="py-3.5 px-4">Confidence</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tickets.map((t) => {
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
                      <td className="py-3.5 px-4 text-slate-600 max-w-[240px] truncate">
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
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {t.confidence.toFixed(2)}
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
                          aria-label={`View ${t.ticketId}`}
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

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            Showing page <strong>{pagination.page}</strong> of{' '}
            <strong>{pagination.totalPages}</strong> ({pagination.total} total tickets)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrevPage || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

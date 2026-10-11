import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  X,
  Edit3,
  Save,
  Clock,
  Cpu,
  History,
  FileText,
} from 'lucide-react';
import { AuthUser, Ticket, TicketCategory, TicketPriority } from '../types/ticket';
import { CategoryBadge, PriorityBadge, ReviewStatusBadge } from './Badge';
import { apiClient, ApiClientError } from '../services/api';

interface TicketDetailPanelProps {
  ticket: Ticket | null;
  reviewerApiKey: string;
  onReviewerApiKeyChange: (key: string) => void;
  authUser?: AuthUser | null;
  authToken?: string | null;
  onTicketUpdated: (updated: Ticket) => void;
  onClose?: () => void;
}

type DetailTab = 'overview' | 'explainability' | 'audit';

const ALL_CATEGORIES: TicketCategory[] = ['Technical', 'Billing', 'Access', 'General'];

export const TicketDetailPanel: React.FC<TicketDetailPanelProps> = ({
  ticket,
  reviewerApiKey,
  onReviewerApiKeyChange,
  authUser,
  authToken,
  onTicketUpdated,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copied, setCopied] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [reviewerId, setReviewerId] = useState('student-reviewer@example.com');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  // Manual Specialist Triage / Draft Editor State
  const [isEditingTriage, setIsEditingTriage] = useState(false);
  const [editCategory, setEditCategory] = useState<TicketCategory>('General');
  const [editPriority, setEditPriority] = useState<TicketPriority>('Low');
  const [editSummary, setEditSummary] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [savingTriage, setSavingTriage] = useState(false);

  useEffect(() => {
    setConfirmChecked(false);
    setApprovalError(null);
    setApprovalSuccess(null);
    setReviewerNotes('');
    setIsEditingTriage(false);
    setActiveTab('overview');
    if (ticket) {
      setEditCategory(ticket.category);
      setEditPriority(ticket.priority);
      setEditSummary(ticket.summary);
      setEditDraft(ticket.draftResponse);
    }
  }, [ticket?.ticketId]);

  useEffect(() => {
    if (authUser?.email) {
      setReviewerId(authUser.email);
    }
  }, [authUser?.email]);

  if (!ticket) {
    return (
      <aside className="w-full lg:w-96 bg-white border-l border-slate-200 p-6 flex flex-col justify-center items-center text-center text-slate-500 shrink-0">
        <ShieldCheck className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Ticket Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Select any support ticket from the table or submit a new ticket to inspect its classification, priority, and draft response.
        </p>
      </aside>
    );
  }

  const effectiveCredential = (authToken && authToken.trim()) || reviewerApiKey.trim();

  const confidenceLabel =
    ticket.confidence >= 0.75
      ? 'High'
      : ticket.confidence >= 0.45
      ? 'Moderate'
      : 'Low / Uncertain';

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(ticket.draftResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    setApprovalError(null);
    setApprovalSuccess(null);

    if (!effectiveCredential) {
      setApprovalError(
        'Reviewer authorization required. Sign in with your Reviewer account or enter the REVIEWER_API_KEY secret.'
      );
      return;
    }

    setSavingTriage(true);
    try {
      const response = await apiClient.triageTicket(
        ticket.ticketId,
        {
          category: editCategory,
          priority: editPriority,
          summary: editSummary.trim(),
          draftResponse: editDraft.trim(),
          resolveUncertainty: true,
        },
        effectiveCredential
      );
      setApprovalSuccess(response.message);
      setIsEditingTriage(false);
      onTicketUpdated(response.ticket);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApprovalError(`[HTTP ${err.status}] ${err.message}`);
      } else {
        setApprovalError('Failed to save manual triage changes.');
      }
    } finally {
      setSavingTriage(false);
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApprovalError(null);
    setApprovalSuccess(null);

    if (!confirmChecked) {
      setApprovalError(
        'Please check the explicit confirmation box before approving the draft response.'
      );
      return;
    }

    if (!effectiveCredential) {
      setApprovalError(
        'Reviewer API key is required. Enter your server REVIEWER_API_KEY or sign in to authorize approval.'
      );
      return;
    }

    setApproving(true);
    try {
      const response = await apiClient.approveTicket(
        ticket.ticketId,
        {
          approved: true,
          reviewerId: reviewerId.trim() || 'authorized-reviewer',
          reviewerNotes: reviewerNotes.trim() || undefined,
        },
        effectiveCredential
      );
      setApprovalSuccess(response.message);
      onTicketUpdated(response.ticket);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApprovalError(`[HTTP ${err.status}] ${err.message}`);
      } else {
        setApprovalError('Failed to approve ticket draft due to an unexpected error.');
      }
    } finally {
      setApproving(false);
    }
  };

  const maxCatScore = ticket.categoryScores
    ? Math.max(1, ...Object.values(ticket.categoryScores))
    : 1;

  const auditEntries =
    ticket.auditLog && ticket.auditLog.length > 0
      ? ticket.auditLog
      : [
          {
            action: 'created' as const,
            actor: 'ai-triage-engine',
            timestamp: ticket.createdAt,
            details: `Ticket classified as ${ticket.category} (${ticket.priority} priority, confidence ${ticket.confidence.toFixed(
              2
            )}) and routed to ${ticket.assignedTeam}.`,
          },
          ...(ticket.approvalMetadata?.approvedBy
            ? [
                {
                  action: 'approved' as const,
                  actor: ticket.approvalMetadata.approvedBy,
                  timestamp: ticket.approvalMetadata.approvedAt || ticket.updatedAt,
                  details: `Draft response approved for human dispatch.${
                    ticket.approvalMetadata.reviewerNotes
                      ? ` Notes: ${ticket.approvalMetadata.reviewerNotes}`
                      : ''
                  }`,
                },
              ]
            : []),
        ];

  return (
    <aside
      aria-label="Ticket Details"
      className="w-full lg:w-[410px] xl:w-[440px] bg-white border-l border-slate-200 p-6 overflow-y-auto shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-slate-900">Ticket Details</h2>
          <ReviewStatusBadge status={ticket.reviewStatus} />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="mt-3 grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('explainability')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'explainability'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>AI Signals</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'audit'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* Uncertainty / Manual Review Warning */}
      {(ticket.isUncertain || ticket.reviewStatus === 'needs_review') && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-semibold">Mandatory Manual Review Required</p>
            <p>
              This ticket exhibits low confidence or competing domain signals. Automatic draft approval is blocked until a human specialist triages the issue.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'explainability' ? (
        <div className="mt-4 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Confidence Proxy</span>
              <span className="font-extrabold text-slate-900">
                {ticket.confidence.toFixed(2)} ({confidenceLabel})
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.round(ticket.confidence * 100)}%` }}
                className={`h-full rounded-full ${
                  ticket.confidence >= 0.45 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Configured minimum threshold for auto-queueing: <strong>0.45</strong>
            </p>
          </div>

          {ticket.categoryScores && (
            <div className="space-y-2.5 pt-2">
              <p className="font-bold text-slate-800">
                4-Category Hybrid Score Distribution
              </p>
              {ALL_CATEGORIES.map((cat) => {
                const score = ticket.categoryScores?.[cat] ?? 0;
                const pct = Math.min(
                  100,
                  Math.max(4, Math.round((score / maxCatScore) * 100))
                );
                const isTop = ticket.category === cat;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between">
                      <span
                        className={`font-semibold ${
                          isTop ? 'text-indigo-700' : 'text-slate-600'
                        }`}
                      >
                        {cat}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {score.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          isTop ? 'bg-indigo-600' : 'bg-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <p className="font-bold text-slate-800 mb-1.5">Matched Domain Signals</p>
            {ticket.matchedSignals && ticket.matchedSignals.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ticket.matchedSignals.map((sig) => (
                  <span
                    key={sig}
                    className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px]"
                  >
                    {sig}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No strong domain keywords matched.</p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="font-bold text-slate-800 mb-1.5">Priority Policy Triggers</p>
            <div className="flex flex-wrap gap-1.5">
              {(ticket.prioritySignals || []).map((sig) => (
                <span
                  key={sig}
                  className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[11px]"
                >
                  {sig}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="font-bold text-slate-800 mb-1">Full Explanation</p>
            <p className="text-slate-600 leading-relaxed">
              {ticket.classificationExplanation}
            </p>
          </div>
        </div>
      ) : activeTab === 'audit' ? (
        <div className="mt-4 space-y-4 text-xs">
          <p className="font-bold text-slate-800">
            Immutable Ticket Activity &amp; Audit Trail
          </p>
          <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {auditEntries.map((entry, idx) => (
              <div key={idx} className="relative bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                <span
                  className={`absolute -left-[17px] top-3.5 w-3 h-3 rounded-full border-2 border-white ${
                    entry.action === 'approved'
                      ? 'bg-emerald-500'
                      : entry.action === 'triaged'
                      ? 'bg-indigo-600'
                      : 'bg-blue-500'
                  }`}
                />
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-indigo-700">
                    {entry.action}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-800 mb-0.5">
                  Actor: {entry.actor}
                </p>
                <p className="text-slate-600 leading-relaxed">{entry.details}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Ticket ID & Customer Message */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Ticket ID
                </p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{ticket.ticketId}</p>
              </div>

              {ticket.reviewStatus !== 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditCategory(ticket.category);
                    setEditPriority(ticket.priority);
                    setEditSummary(ticket.summary);
                    setEditDraft(ticket.draftResponse);
                    setIsEditingTriage((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingTriage ? 'Cancel Edit' : 'Manual Triage / Edit'}</span>
                </button>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Customer Message
              </p>
              <div className="mt-1 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-700 leading-relaxed">
                &ldquo;{ticket.message}&rdquo;
              </div>
            </div>
          </div>

          {isEditingTriage ? (
            <form
              onSubmit={handleSaveTriage}
              className="mt-4 pt-4 border-t border-slate-200 space-y-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border"
            >
              <p className="font-bold text-slate-800">
                Manual Specialist Triage &amp; Draft Editor
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="triage-category"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="triage-category"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as TicketCategory)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="Access">Access</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="triage-priority"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Priority
                  </label>
                  <select
                    id="triage-priority"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TicketPriority)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="triage-summary"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Issue Summary
                </label>
                <textarea
                  id="triage-summary"
                  rows={2}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="triage-draft"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Draft Response
                </label>
                <textarea
                  id="triage-draft"
                  rows={5}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              {!authToken && (
                <div>
                  <label
                    htmlFor="triage-key"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Reviewer Authorization Key
                  </label>
                  <input
                    id="triage-key"
                    type="password"
                    value={reviewerApiKey}
                    onChange={(e) => onReviewerApiKeyChange(e.target.value)}
                    placeholder="Enter REVIEWER_API_KEY"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={savingTriage}
                className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {savingTriage
                    ? 'Saving Triage...'
                    : 'Save Triage & Mark Ready for Approval'}
                </span>
              </button>
            </form>
          ) : (
            <>
              {/* Classification Metadata Grid */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Category</span>
                  <CategoryBadge category={ticket.category} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Priority</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Assigned Team</span>
                  <span className="font-semibold text-slate-800">{ticket.assignedTeam}</span>
                </div>
                {ticket.slaTarget && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Target SLA</span>
                    </span>
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {ticket.slaTarget.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">Summary</p>
                <p className="text-xs text-slate-800 leading-relaxed">{ticket.summary}</p>
              </div>

              {/* Draft Response */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-slate-500">Draft Response</p>
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Draft</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-3.5 text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
                  {ticket.draftResponse}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Automated draft suggestion. Approval records sign-off in MongoDB and never automatically sends emails to customers.
                </p>
              </div>
            </>
          )}

          {/* Confidence & Explanation */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Confidence Proxy</span>
              <span className="font-bold text-slate-900">
                {ticket.confidence.toFixed(2)} ({confidenceLabel})
              </span>
            </div>

            <div>
              <p className="text-slate-800 font-semibold mb-1">Explanation</p>
              <p className="text-slate-600 leading-relaxed">
                {ticket.classificationExplanation}
              </p>
            </div>
          </div>

          {/* Timestamps & Approval Metadata */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Created At</span>
              <span className="font-medium text-slate-800">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
            {ticket.approvalMetadata?.approvedBy && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reviewed By</span>
                  <span className="font-semibold text-slate-900">
                    {ticket.approvalMetadata.approvedBy}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reviewed At</span>
                  <span className="font-medium text-slate-800">
                    {ticket.approvalMetadata.approvedAt
                      ? new Date(ticket.approvalMetadata.approvedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                {ticket.approvalMetadata.reviewerNotes && (
                  <div className="pt-1">
                    <span className="text-slate-500 block">Reviewer Notes:</span>
                    <span className="text-slate-700 italic">
                      {ticket.approvalMetadata.reviewerNotes}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Feedback Messages */}
      {approvalError && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700"
        >
          {approvalError}
        </div>
      )}

      {approvalSuccess && (
        <div
          role="status"
          className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800"
        >
          {approvalSuccess}
        </div>
      )}

      {/* Approval Action Section */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        {ticket.reviewStatus === 'approved' ? (
          <div className="w-full py-3 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Draft Approved</span>
          </div>
        ) : ticket.reviewStatus === 'needs_review' || ticket.isUncertain ? (
          <div className="space-y-2">
            <div className="w-full py-3 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Blocked — Requires Manual Specialist Triage</span>
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Click <strong>Manual Triage / Edit</strong> on the Overview tab to confirm category/priority and unlock approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleApproveSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="detail-reviewer-id"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Reviewer Identifier
              </label>
              <input
                id="detail-reviewer-id"
                type="text"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                placeholder="student@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {!authToken && (
              <div>
                <label
                  htmlFor="detail-reviewer-key"
                  className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1"
                >
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Reviewer Authorization Key</span>
                </label>
                <input
                  id="detail-reviewer-key"
                  type="password"
                  value={reviewerApiKey}
                  onChange={(e) => onReviewerApiKeyChange(e.target.value)}
                  placeholder="Enter REVIEWER_API_KEY secret"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="detail-reviewer-notes"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Reviewer Notes (Optional)
              </label>
              <input
                id="detail-reviewer-notes"
                type="text"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Verified ticket context and draft accuracy"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                I have reviewed the draft response and explicitly approve it. (No customer email is sent automatically.)
              </span>
            </label>

            <button
              type="submit"
              disabled={approving}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{approving ? 'Approving Draft...' : 'Approve Draft Response'}</span>
            </button>
          </form>
        )}
      </div>
    </aside>
  );
};

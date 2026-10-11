import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Clock,
  Tag,
} from 'lucide-react';
import { Ticket, TicketAnalysisPreview, TicketCategory } from '../types/ticket';
import { apiClient, ApiClientError } from '../services/api';
import { CategoryBadge, PriorityBadge, ReviewStatusBadge } from '../components/Badge';

interface NewTicketPageProps {
  onTicketCreated: (ticket: Ticket) => void;
}

const SAMPLE_SCENARIOS = [
  {
    label: 'Access (Password & MFA Lockout)',
    ticketId: 'TCK-1001',
    message:
      'I cannot access my account after resetting my password. The MFA authenticator code is being rejected.',
  },
  {
    label: 'Billing (Duplicate Invoice Charge)',
    ticketId: 'TCK-1002',
    message:
      'We were charged twice on our monthly Azure subscription invoice INV-90210 for $850. Please check the duplicate charge on our billing statement.',
  },
  {
    label: 'Technical (Critical Production Outage)',
    ticketId: 'TCK-1003',
    message:
      'Production API gateway is returning HTTP 502 Bad Gateway errors across all regional endpoints. All 500+ enterprise customers are experiencing a complete service outage.',
  },
  {
    label: 'General (SOC 2 & GDPR Documentation)',
    ticketId: 'TCK-1004',
    message:
      'We are preparing for our annual compliance audit and need a copy of your SOC 2 Type II report, user guides, and GDPR data processing documentation.',
  },
  {
    label: 'Ambiguous (Routes to Manual Review)',
    ticketId: 'TCK-1005',
    message:
      'Need help urgently with our portal, something is wrong and we cannot proceed.',
  },
];

const CATEGORIES: TicketCategory[] = ['Technical', 'Billing', 'Access', 'General'];

export const NewTicketPage: React.FC<NewTicketPageProps> = ({ onTicketCreated }) => {
  const [ticketId, setTicketId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<TicketAnalysisPreview | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{
    status: number;
    type: string;
    message: string;
  } | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  const generateRandomTicketId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    setTicketId(`TCK-${num}`);
    setValidationError(null);
  };

  const validateClientInput = (): string | null => {
    const trimmedId = ticketId.trim();
    const trimmedMsg = message.trim();

    if (!trimmedId) {
      return 'Ticket ID is required (for example, TCK-1001).';
    }
    if (trimmedId.length < 3 || trimmedId.length > 40) {
      return 'Ticket ID must be between 3 and 40 characters.';
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(trimmedId)) {
      return 'Ticket ID may only contain letters, numbers, hyphens, and underscores.';
    }
    if (!trimmedMsg) {
      return 'Customer message cannot be empty.';
    }
    if (trimmedMsg.length < 5) {
      return 'Customer message must be at least 5 characters long.';
    }
    return null;
  };

  const handleRunLivePreview = async () => {
    setValidationError(null);
    setServerError(null);
    const trimmedMsg = message.trim();
    if (trimmedMsg.length < 5) {
      setValidationError('Enter at least 5 characters in Customer Message to preview AI analysis.');
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await apiClient.analyzePreview({
        ticketId: ticketId.trim() || 'PREVIEW-001',
        message: trimmedMsg,
      });
      setPreviewResult(response.analysis);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setValidationError(err.message);
      } else {
        setValidationError('Unable to run live AI preview.');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);
    setCreatedTicket(null);

    const clientErr = validateClientInput();
    if (clientErr) {
      setValidationError(clientErr);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.createTicket({
        ticketId: ticketId.trim(),
        message: message.trim(),
      });
      setCreatedTicket(response.ticket);
      onTicketCreated(response.ticket);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError({
          status: err.status,
          type: err.errorType,
          message: err.message,
        });
      } else {
        setServerError({
          status: 500,
          type: 'UnexpectedError',
          message: 'An unexpected error occurred while submitting the ticket.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const maxCategoryScore = previewResult
    ? Math.max(1, ...Object.values(previewResult.categoryScores))
    : 1;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Submit &amp; Analyze a Support Ticket
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter a unique Ticket ID and customer support message. You can preview the live TF-IDF + Domain Lexicon explainability breakdown in real time before saving to MongoDB Atlas.
        </p>
      </div>

      {/* Quick Scenario Presets for Demo & Testing */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Quick-Fill Fictional Demo Scenarios</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_SCENARIOS.map((preset) => (
            <button
              key={preset.ticketId}
              type="button"
              onClick={() => {
                setTicketId(preset.ticketId);
                setMessage(preset.message);
                setValidationError(null);
                setServerError(null);
                setPreviewResult(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs font-medium transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submission Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5"
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="ticket-id-input"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
            >
              Ticket ID <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={generateRandomTicketId}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Generate Unique ID</span>
            </button>
          </div>
          <input
            id="ticket-id-input"
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="e.g., TCK-1001"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="ticket-message-input"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            Customer Message <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="ticket-message-input"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the billing, technical, access, or general support issue..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Client-side Validation Error */}
        {validationError && (
          <div
            role="alert"
            className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5 text-xs text-amber-800"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Validation Error: </span>
              <span>{validationError}</span>
            </div>
          </div>
        )}

        {/* Server-side Validation / Duplicate / Network Error */}
        {serverError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-800"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {serverError.status === 409
                  ? 'Duplicate Ticket ID (HTTP 409 Conflict): '
                  : serverError.status === 0
                  ? 'Network Error: '
                  : `Server Error (HTTP ${serverError.status}): `}
              </span>
              <span>{serverError.message}</span>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {createdTicket && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-xs text-emerald-900"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                Ticket {createdTicket.ticketId} Created &amp; Classified Successfully!
              </p>
              <p>
                Category: <strong>{createdTicket.category}</strong> &bull; Priority:{' '}
                <strong>{createdTicket.priority}</strong> &bull; Assigned Team:{' '}
                <strong>{createdTicket.assignedTeam}</strong> &bull; Review Status:{' '}
                <strong>{createdTicket.reviewStatus}</strong>
              </p>
              <p className="text-emerald-700">
                Inspect the full explanation, SLA target, and draft response in the Ticket Details panel on the right.
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={previewLoading}
            onClick={handleRunLivePreview}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all"
          >
            <Cpu className="w-4 h-4" />
            <span>
              {previewLoading
                ? 'Analyzing Message...'
                : 'Preview AI Explainability (Sandbox)'}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTicketId('');
                setMessage('');
                setValidationError(null);
                setServerError(null);
                setCreatedTicket(null);
                setPreviewResult(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Classifying & Saving...' : 'Classify & Create Ticket'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Stateless Live AI Explainability Sandbox Output */}
      {previewResult && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Live AI Explainability Preview (Stateless — Not Yet Saved)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Shows real-time hybrid TF-IDF + Domain Lexicon scoring and deterministic priority SLA evaluation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CategoryBadge category={previewResult.category} />
              <PriorityBadge priority={previewResult.priority} />
              <ReviewStatusBadge status={previewResult.reviewStatus} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 4-Category Score Bars */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">
                4-Category Hybrid Score Breakdown
              </p>
              {CATEGORIES.map((cat) => {
                const score = previewResult.categoryScores?.[cat] ?? 0;
                const widthPct = Math.min(
                  100,
                  Math.max(4, Math.round((score / maxCategoryScore) * 100))
                );
                const isWinner = previewResult.category === cat;
                return (
                  <div key={cat} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold ${
                          isWinner ? 'text-indigo-700' : 'text-slate-600'
                        }`}
                      >
                        {cat} {isWinner ? '(Top Match)' : ''}
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {score.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className={`h-full rounded-full transition-all ${
                          isWinner ? 'bg-indigo-600' : 'bg-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confidence, SLA Target & Signals */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-600 font-medium">Confidence Proxy</span>
                <span className="font-extrabold text-slate-900">
                  {previewResult.confidence.toFixed(2)} (Threshold:{' '}
                  {previewResult.confidenceThreshold.toFixed(2)})
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
                <span className="text-blue-800 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Target SLA Policy</span>
                </span>
                <span className="font-bold text-blue-900">
                  {previewResult.slaTarget.label}
                </span>
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Matched Domain &amp; Priority Signals</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...previewResult.matchedSignals,
                    ...previewResult.prioritySignals,
                  ].map((sig) => (
                    <span
                      key={sig}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px]"
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
            <strong className="text-slate-800">Explanation: </strong>
            {previewResult.classificationExplanation}
          </div>
        </div>
      )}
    </div>
  );
};

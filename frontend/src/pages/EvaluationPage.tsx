import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CheckCircle2, RefreshCw, Info } from 'lucide-react';
import { EvaluationReport, TicketCategory } from '../types/ticket';
import { apiClient, ApiClientError } from '../services/api';
import { CategoryBadge, PriorityBadge } from '../components/Badge';

interface EvaluationPageProps {
  reviewerApiKey: string;
}

const CATEGORIES: TicketCategory[] = ['Billing', 'Technical', 'Access', 'General'];

export const EvaluationPage: React.FC<EvaluationPageProps> = ({ reviewerApiKey }) => {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvaluation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getEvaluation(reviewerApiKey);
      setReport(response.evaluation);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Unable to load held-out evaluation report.');
      }
    } finally {
      setLoading(false);
    }
  }, [reviewerApiKey]);

  useEffect(() => {
    loadEvaluation();
  }, [loadEvaluation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Held-Out Classifier &amp; Priority Evaluation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Live execution of the explainable hybrid TF-IDF + domain lexicon classifier against the held-out evaluation dataset (<code>backend/sample_data/held_out_test_tickets.json</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvaluation}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-Run Evaluation</span>
        </button>
      </div>

      {/* Methodology & Limitations Notice */}
      <div className="rounded-2xl bg-blue-50/80 border border-blue-200 p-4 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Evaluation Integrity &amp; Dataset Split Disclosure</p>
          <p>
            The TF-IDF vocabulary and category centroids are built exclusively from the 24-ticket development dataset (<code>development_tickets.json</code>). The metrics below are computed live on the separate 12-ticket held-out test set (<code>held_out_test_tickets.json</code>, 3 tickets per category). Because this is a small synthetic dataset created for assessment verification, high accuracy on clear test cases does not imply broad generalization to noisy production support traffic.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      {loading && !report ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Running held-out classifier evaluation...
        </div>
      ) : (
        report && (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Held-Out Test Tickets</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">
                  {report.totalTestTickets}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Source: {report.datasetName}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Category Accuracy</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                  {(report.overallCategoryAccuracy * 100).toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {report.correctCategoryPredictions} / {report.totalTestTickets} correct
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Priority Accuracy</p>
                <p className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {(report.overallPriorityAccuracy * 100).toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {report.correctPriorityPredictions} / {report.totalTestTickets} correct
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Team Routing Accuracy</p>
                <p className="text-3xl font-extrabold text-blue-600 mt-2">
                  {(report.overallTeamAccuracy * 100).toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {report.correctTeamAssignments} / {report.totalTestTickets} correct
                </p>
              </div>
            </div>

            {/* Per-Category Performance & Confusion Matrix */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Per-Category Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Per-Category Performance Metrics
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Expected</th>
                        <th className="py-2.5 px-3">Predicted</th>
                        <th className="py-2.5 px-3">Precision</th>
                        <th className="py-2.5 px-3">Recall</th>
                        <th className="py-2.5 px-3">F1 Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.perCategoryMetrics.map((m) => (
                        <tr key={m.category}>
                          <td className="py-3 px-3">
                            <CategoryBadge category={m.category} />
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {m.totalExpected}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {m.totalPredicted}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {(m.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {(m.recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 font-bold text-indigo-600">
                            {m.f1Score.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confusion Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Confusion Matrix (Rows = Actual, Columns = Predicted)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-3 text-left">Actual \ Pred</th>
                        {CATEGORIES.map((c) => (
                          <th key={c} className="py-2.5 px-3">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {CATEGORIES.map((actual) => (
                        <tr key={actual}>
                          <td className="py-3 px-3 text-left font-bold text-slate-800">
                            {actual}
                          </td>
                          {CATEGORIES.map((pred) => {
                            const val = report.confusionMatrix[actual][pred];
                            const isDiagonal = actual === pred;
                            return (
                              <td
                                key={pred}
                                className={`py-3 px-3 font-bold ${
                                  isDiagonal && val > 0
                                    ? 'bg-emerald-50 text-emerald-700 rounded-lg'
                                    : val > 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Individual Held-Out Predictions */}
            {report.predictions && report.predictions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900">
                    Held-Out Test Ticket Predictions
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase bg-slate-50/50">
                        <th className="py-3 px-4">Ticket ID</th>
                        <th className="py-3 px-4">Predicted Category</th>
                        {report.predictions[0]?.expectedCategory && (
                          <th className="py-3 px-4">Expected Category</th>
                        )}
                        <th className="py-3 px-4">Category Result</th>
                        <th className="py-3 px-4">Predicted Priority</th>
                        {report.predictions[0]?.expectedPriority && (
                          <th className="py-3 px-4">Expected Priority</th>
                        )}
                        <th className="py-3 px-4">Assigned Team</th>
                        <th className="py-3 px-4">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.predictions.map((p) => (
                        <tr key={p.ticketId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {p.ticketId}
                          </td>
                          <td className="py-3 px-4">
                            <CategoryBadge category={p.predictedCategory} />
                          </td>
                          {p.expectedCategory && (
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {p.expectedCategory}
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                p.categoryCorrect
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {p.categoryCorrect ? 'PASS' : 'MISMATCH'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <PriorityBadge priority={p.predictedPriority} />
                          </td>
                          {p.expectedPriority && (
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {p.expectedPriority}
                            </td>
                          )}
                          <td className="py-3 px-4 text-slate-700">{p.predictedTeam}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {p.confidence.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};

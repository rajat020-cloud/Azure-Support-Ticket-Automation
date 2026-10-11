import React, { useState, useEffect } from 'react';
import { ExternalLink, Server, Shield, Activity } from 'lucide-react';
import { HealthResponse } from '../types/ticket';
import { apiClient, getApiBaseUrl } from '../services/api';

export const ApiDocsPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    apiClient
      .getHealth()
      .then((res) => {
        setHealth(res);
        setHealthError(null);
      })
      .catch((err) => {
        setHealthError(err instanceof Error ? err.message : 'Unable to reach /api/health');
      });
  }, []);

  const endpoints = [
    {
      method: 'GET',
      path: '/api/health',
      auth: 'Public',
      description: 'Returns service health and MongoDB connection status without exposing credentials.',
    },
    {
      method: 'POST',
      path: '/api/tickets',
      auth: 'Public',
      description:
        'Validates ticketId and message, classifies category, determines priority, routes to team, generates summary and draft response, and persists to MongoDB (201 Created, 400 Invalid, 409 Duplicate).',
    },
    {
      method: 'GET',
      path: '/api/tickets',
      auth: 'Public',
      description:
        'Lists support tickets with pagination, search, category/priority/reviewStatus filtering, and deterministic sorting.',
    },
    {
      method: 'GET',
      path: '/api/tickets/:ticketId',
      auth: 'Public',
      description: 'Retrieves a single support ticket by ticketId or returns HTTP 404.',
    },
    {
      method: 'POST',
      path: '/api/tickets/:ticketId/approve',
      auth: 'Reviewer API Key (x-reviewer-api-key)',
      description:
        'Approves an eligible draft response and records reviewer identity and timestamp in MongoDB. Rejects unauthorized requests (401/403), already-approved tickets (409), and uncertain tickets requiring manual triage (422).',
    },
    {
      method: 'GET',
      path: '/api/metrics',
      auth: 'Public',
      description:
        'Returns real-time MongoDB aggregate counts by category, priority, and review status.',
    },
    {
      method: 'GET',
      path: '/api/evaluation',
      auth: 'Public (Labels restricted in production)',
      description:
        'Executes the classifier against held_out_test_tickets.json and returns accuracy, per-category metrics, and confusion matrix.',
    },
    {
      method: 'GET',
      path: '/api/docs',
      auth: 'Public',
      description: 'Interactive Swagger / OpenAPI 3.0 documentation interface.',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            REST API &amp; OpenAPI Reference
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Configured API Base URL: <code className="font-mono font-semibold text-indigo-600">{baseUrl}</code>
          </p>
        </div>
        <a
          href={`${baseUrl}/api/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm self-start"
        >
          <span>Open Swagger UI (/api/docs)</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Live Health Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              health?.database.connected
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Backend Health Status (<code>GET /api/health</code>)
            </h2>
            {healthError ? (
              <p className="text-xs text-rose-600 mt-0.5">{healthError}</p>
            ) : health ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Service: <strong>{health.status}</strong> &bull; MongoDB State:{' '}
                <strong>{health.database.state}</strong>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Checking health endpoint...</p>
            )}
          </div>
        </div>
        <a
          href={`${baseUrl}/api/health`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
        >
          <span>View Raw JSON</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Endpoints Reference Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Implemented REST Endpoints</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {endpoints.map((ep) => (
            <div key={`${ep.method}-${ep.path}`} className="p-5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    ep.method === 'POST'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {ep.method}
                </span>
                <code className="text-xs font-bold text-slate-900">{ep.path}</code>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-medium">
                  <Shield className="w-3 h-3" />
                  {ep.auth}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{ep.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

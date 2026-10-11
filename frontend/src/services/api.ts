import {
  AuthResponse,
  AuthUser,
  DashboardMetricsResponse,
  EvaluationReport,
  HealthResponse,
  ReviewStatus,
  Ticket,
  TicketAnalysisPreview,
  TicketCategory,
  TicketListResponse,
  TicketPriority,
} from '../types/ticket';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly errorType: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status: number,
    errorType = 'ApiError',
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errorType = errorType;
    this.details = details;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://azure-support-ticket-automation.onrender.com';
  }
  return 'http://localhost:5000';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach the backend API server. Verify the backend is running and VITE_API_BASE_URL is configured.',
      0,
      'NetworkError'
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const message =
      typeof data.message === 'string'
        ? data.message
        : `Request failed with HTTP status ${response.status}`;
    const errorType = typeof data.error === 'string' ? data.error : 'ApiError';
    const details = Array.isArray(data.details)
      ? (data.details as Array<{ field: string; message: string }>)
      : undefined;

    throw new ApiClientError(message, response.status, errorType, details);
  }

  return data as T;
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/api/health');
  },

  register(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe(token: string): Promise<{ user: AuthUser }> {
    return request<{ user: AuthUser }>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getMetrics(): Promise<DashboardMetricsResponse> {
    return request<DashboardMetricsResponse>('/api/metrics');
  },

  analyzePreview(payload: {
    ticketId?: string;
    message: string;
  }): Promise<{ analysis: TicketAnalysisPreview }> {
    return request<{ analysis: TicketAnalysisPreview }>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createTicket(payload: { ticketId: string; message: string }): Promise<{ ticket: Ticket }> {
    return request<{ ticket: Ticket }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listTickets(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: TicketCategory | '';
    priority?: TicketPriority | '';
    reviewStatus?: ReviewStatus | '';
    sortBy?: 'createdAt' | 'ticketId' | 'priority' | 'confidence';
    sortOrder?: 'asc' | 'desc';
  }): Promise<TicketListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search && params.search.trim()) query.set('search', params.search.trim());
    if (params.category) query.set('category', params.category);
    if (params.priority) query.set('priority', params.priority);
    if (params.reviewStatus) query.set('reviewStatus', params.reviewStatus);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const qs = query.toString();
    return request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ''}`);
  },

  getTicketById(ticketId: string): Promise<{ ticket: Ticket }> {
    return request<{ ticket: Ticket }>(`/api/tickets/${encodeURIComponent(ticketId)}`);
  },

  triageTicket(
    ticketId: string,
    payload: {
      category?: TicketCategory;
      priority?: TicketPriority;
      summary?: string;
      draftResponse?: string;
      resolveUncertainty?: boolean;
    },
    credential: string
  ): Promise<{ message: string; ticket: Ticket }> {
    return request<{ message: string; ticket: Ticket }>(
      `/api/tickets/${encodeURIComponent(ticketId)}/triage`,
      {
        method: 'PATCH',
        headers: {
          'x-reviewer-api-key': credential,
        },
        body: JSON.stringify(payload),
      }
    );
  },

  approveTicket(
    ticketId: string,
    payload: { approved: boolean; reviewerId: string; reviewerNotes?: string },
    reviewerApiKey: string
  ): Promise<{ message: string; ticket: Ticket }> {
    return request<{ message: string; ticket: Ticket }>(
      `/api/tickets/${encodeURIComponent(ticketId)}/approve`,
      {
        method: 'POST',
        headers: {
          'x-reviewer-api-key': reviewerApiKey,
        },
        body: JSON.stringify(payload),
      }
    );
  },

  getEvaluation(reviewerApiKey?: string): Promise<{ evaluation: EvaluationReport }> {
    const headers: Record<string, string> = {};
    if (reviewerApiKey && reviewerApiKey.trim()) {
      headers['x-reviewer-api-key'] = reviewerApiKey.trim();
    }
    return request<{ evaluation: EvaluationReport }>('/api/evaluation', {
      headers,
    });
  },
};

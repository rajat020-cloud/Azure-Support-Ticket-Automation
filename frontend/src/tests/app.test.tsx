import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewTicketPage } from '../pages/NewTicketPage';
import { TicketDetailPanel } from '../components/TicketDetailPanel';
import { DashboardPage } from '../pages/DashboardPage';
import { apiClient, ApiClientError } from '../services/api';
import { Ticket, DashboardMetricsResponse } from '../types/ticket';

const samplePendingTicket: Ticket = {
  ticketId: 'TCK-1001',
  message: 'I cannot access my account after resetting my password.',
  category: 'Access',
  priority: 'High',
  assignedTeam: 'Identity and Access Support',
  summary: '[Access | High] Customer reported account lockout.',
  draftResponse: '[DRAFT — AWAITING HUMAN REVIEW & APPROVAL]\nHello, we will assist you.',
  confidence: 0.92,
  classificationExplanation: 'Matched signals: password, resetting my password.',
  matchedSignals: ['password', 'resetting my password'],
  prioritySignals: ['active_account_lockout'],
  isUncertain: false,
  reviewStatus: 'pending_review',
  approvalMetadata: {
    approvedBy: null,
    approvedAt: null,
    reviewerNotes: null,
  },
  createdAt: '2026-10-11T10:00:00.000Z',
  updatedAt: '2026-10-11T10:00:00.000Z',
};

const sampleUncertainTicket: Ticket = {
  ...samplePendingTicket,
  ticketId: 'TCK-AMB-99',
  message: 'Something is wrong with the portal.',
  category: 'General',
  priority: 'Low',
  assignedTeam: 'General Support',
  confidence: 0.2,
  isUncertain: true,
  reviewStatus: 'needs_review',
};

describe('Frontend Component & Interaction Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates empty ticketId and empty message on NewTicketPage before calling API', async () => {
    const onCreated = vi.fn();
    render(<NewTicketPage onTicketCreated={onCreated} />);

    const submitBtn = screen.getByRole('button', { name: /Classify & Create Ticket/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ticket ID is required/i);
    expect(onCreated).not.toHaveBeenCalled();

    const idInput = screen.getByLabelText(/Ticket ID/i);
    fireEvent.change(idInput, { target: { value: 'TCK-1005' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Customer message cannot be empty/i
    );
  });

  it('displays duplicate ticket ID (HTTP 409) error from backend on NewTicketPage', async () => {
    vi.spyOn(apiClient, 'createTicket').mockRejectedValueOnce(
      new ApiClientError('A ticket with this ticketId already exists.', 409, 'ConflictError')
    );

    render(<NewTicketPage onTicketCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Ticket ID/i), {
      target: { value: 'TCK-1001' },
    });
    fireEvent.change(screen.getByLabelText(/Customer Message/i), {
      target: { value: 'We were charged twice on our monthly invoice.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Classify & Create Ticket/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Duplicate Ticket ID \(HTTP 409 Conflict\)/i);
  });

  it('requires explicit confirmation checkbox and reviewer key before approving a draft in TicketDetailPanel', async () => {
    const approveSpy = vi.spyOn(apiClient, 'approveTicket').mockResolvedValueOnce({
      message: 'Draft approved successfully.',
      ticket: {
        ...samplePendingTicket,
        reviewStatus: 'approved',
        approvalMetadata: {
          approvedBy: 'student-reviewer@example.com',
          approvedAt: '2026-10-11T12:00:00.000Z',
          reviewerNotes: null,
        },
      },
    });

    const onUpdated = vi.fn();
    render(
      <TicketDetailPanel
        ticket={samplePendingTicket}
        reviewerApiKey="secret-key-123"
        onReviewerApiKeyChange={vi.fn()}
        onTicketUpdated={onUpdated}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /Approve Draft Response/i });
    // Click without checking confirmation checkbox
    fireEvent.click(approveBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Please check the explicit confirmation box/i
    );
    expect(approveSpy).not.toHaveBeenCalled();

    // Check confirmation box and submit
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'TCK-1001',
        expect.objectContaining({ approved: true }),
        'secret-key-123'
      );
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it('blocks approval and displays warning when ticket is uncertain (needs_review)', () => {
    render(
      <TicketDetailPanel
        ticket={sampleUncertainTicket}
        reviewerApiKey="secret-key-123"
        onReviewerApiKeyChange={vi.fn()}
        onTicketUpdated={vi.fn()}
      />
    );

    expect(screen.getByText(/Mandatory Manual Review Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Blocked — Requires Manual Specialist Triage/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Approve Draft Response/i })
    ).not.toBeInTheDocument();
  });

  it('renders Dashboard metrics and recent tickets accurately', () => {
    const metricsData: DashboardMetricsResponse = {
      totalTickets: 14,
      byCategory: { Billing: 4, Technical: 5, Access: 3, General: 2 },
      byPriority: { Low: 3, Medium: 5, High: 4, Critical: 2 },
      byReviewStatus: { pending_review: 6, needs_review: 2, approved: 6 },
      recentTickets: [samplePendingTicket],
    };

    render(
      <DashboardPage
        metrics={metricsData}
        loading={false}
        error={null}
        selectedTicketId="TCK-1001"
        onSelectTicket={vi.fn()}
        onNavigate={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('TCK-1001')).toBeInTheDocument();
    expect(screen.getByText('Identity and Access Support')).toBeInTheDocument();
  });
});

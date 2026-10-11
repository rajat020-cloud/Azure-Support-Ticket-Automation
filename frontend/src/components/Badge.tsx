import React from 'react';
import { ReviewStatus, TicketCategory, TicketPriority } from '../types/ticket';

export const CategoryBadge: React.FC<{ category: TicketCategory }> = ({ category }) => {
  const styles: Record<TicketCategory, string> = {
    Technical: 'bg-blue-100 text-blue-700 border-blue-200',
    Billing: 'bg-purple-100 text-purple-700 border-purple-200',
    Access: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    General: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[category]}`}
    >
      {category}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
  const styles: Record<TicketPriority, string> = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[priority]}`}
    >
      {priority}
    </span>
  );
};

export const ReviewStatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const config: Record<ReviewStatus, { label: string; classes: string }> = {
    pending_review: {
      label: 'Pending Review',
      classes: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    needs_review: {
      label: 'Needs Review',
      classes: 'bg-rose-100 text-rose-700 border-rose-200',
    },
    approved: {
      label: 'Approved',
      classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
  };

  const item = config[status] || config.pending_review;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.classes}`}
    >
      {item.label}
    </span>
  );
};

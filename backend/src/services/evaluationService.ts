import fs from 'fs';
import path from 'path';
import {
  AssignedTeam,
  TICKET_CATEGORIES,
  TicketCategory,
  TicketPriority,
} from '../models/Ticket';
import { classifyTicketMessage } from './classifierService';
import { determineTicketPriority } from './priorityService';
import { routeTicket } from './routingService';

export interface LabelledTestTicket {
  ticketId: string;
  message: string;
  expectedCategory: TicketCategory;
  expectedPriority: TicketPriority;
  expectedAssignedTeam: AssignedTeam;
}

export interface CategoryMetric {
  category: TicketCategory;
  totalExpected: number;
  totalPredicted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  categoryAccuracy: number;
}

export interface PredictionRecord {
  ticketId: string;
  predictedCategory: TicketCategory;
  expectedCategory?: TicketCategory;
  categoryCorrect: boolean;
  predictedPriority: TicketPriority;
  expectedPriority?: TicketPriority;
  priorityCorrect: boolean;
  predictedTeam: AssignedTeam;
  confidence: number;
  isUncertain: boolean;
}

export interface EvaluationReport {
  datasetName: string;
  evaluatedAt: string;
  totalTestTickets: number;
  correctCategoryPredictions: number;
  overallCategoryAccuracy: number;
  correctPriorityPredictions: number;
  overallPriorityAccuracy: number;
  correctTeamAssignments: number;
  overallTeamAccuracy: number;
  perCategoryMetrics: CategoryMetric[];
  confusionMatrix: Record<TicketCategory, Record<TicketCategory, number>>;
  predictions?: PredictionRecord[];
}

function loadHeldOutDataset(): LabelledTestTicket[] {
  const candidates = [
    path.resolve(process.cwd(), 'sample_data', 'held_out_test_tickets.json'),
    path.resolve(process.cwd(), 'backend', 'sample_data', 'held_out_test_tickets.json'),
    path.resolve(__dirname, '../../sample_data/held_out_test_tickets.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8');
      return JSON.parse(content) as LabelledTestTicket[];
    }
  }

  throw new Error('Held-out test dataset file (held_out_test_tickets.json) not found.');
}

export function evaluateHeldOutDataset(includeLabelsInPredictions = true): EvaluationReport {
  const testTickets = loadHeldOutDataset();
  const totalTestTickets = testTickets.length;

  const confusionMatrix: Record<TicketCategory, Record<TicketCategory, number>> = {
    Billing: { Billing: 0, Technical: 0, Access: 0, General: 0 },
    Technical: { Billing: 0, Technical: 0, Access: 0, General: 0 },
    Access: { Billing: 0, Technical: 0, Access: 0, General: 0 },
    General: { Billing: 0, Technical: 0, Access: 0, General: 0 },
  };

  let correctCategoryPredictions = 0;
  let correctPriorityPredictions = 0;
  let correctTeamAssignments = 0;

  const predictions: PredictionRecord[] = [];

  for (const ticket of testTickets) {
    const classification = classifyTicketMessage(ticket.message);
    const priorityEval = determineTicketPriority(ticket.message, classification.category);
    const routing = routeTicket(
      classification.category,
      priorityEval.priority,
      classification.isUncertain
    );

    const categoryCorrect = classification.category === ticket.expectedCategory;
    const priorityCorrect = priorityEval.priority === ticket.expectedPriority;
    const teamCorrect = routing.assignedTeam === ticket.expectedAssignedTeam;

    if (categoryCorrect) correctCategoryPredictions += 1;
    if (priorityCorrect) correctPriorityPredictions += 1;
    if (teamCorrect) correctTeamAssignments += 1;

    confusionMatrix[ticket.expectedCategory][classification.category] += 1;

    const record: PredictionRecord = {
      ticketId: ticket.ticketId,
      predictedCategory: classification.category,
      categoryCorrect,
      predictedPriority: priorityEval.priority,
      priorityCorrect,
      predictedTeam: routing.assignedTeam,
      confidence: classification.confidence,
      isUncertain: classification.isUncertain,
    };

    if (includeLabelsInPredictions) {
      record.expectedCategory = ticket.expectedCategory;
      record.expectedPriority = ticket.expectedPriority;
    }

    predictions.push(record);
  }

  const perCategoryMetrics: CategoryMetric[] = TICKET_CATEGORIES.map((category) => {
    const tp = confusionMatrix[category][category];
    let fn = 0;
    let fp = 0;

    for (const other of TICKET_CATEGORIES) {
      if (other !== category) {
        fn += confusionMatrix[category][other];
        fp += confusionMatrix[other][category];
      }
    }

    const totalExpected = tp + fn;
    const totalPredicted = tp + fp;
    const precision = totalPredicted > 0 ? Number((tp / totalPredicted).toFixed(4)) : 0;
    const recall = totalExpected > 0 ? Number((tp / totalExpected).toFixed(4)) : 0;
    const f1Score =
      precision + recall > 0
        ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
        : 0;
    const categoryAccuracy = totalExpected > 0 ? Number((tp / totalExpected).toFixed(4)) : 0;

    return {
      category,
      totalExpected,
      totalPredicted,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1Score,
      categoryAccuracy,
    };
  });

  const overallCategoryAccuracy =
    totalTestTickets > 0
      ? Number((correctCategoryPredictions / totalTestTickets).toFixed(4))
      : 0;
  const overallPriorityAccuracy =
    totalTestTickets > 0
      ? Number((correctPriorityPredictions / totalTestTickets).toFixed(4))
      : 0;
  const overallTeamAccuracy =
    totalTestTickets > 0
      ? Number((correctTeamAssignments / totalTestTickets).toFixed(4))
      : 0;

  return {
    datasetName: 'held_out_test_tickets.json',
    evaluatedAt: new Date().toISOString(),
    totalTestTickets,
    correctCategoryPredictions,
    overallCategoryAccuracy,
    correctPriorityPredictions,
    overallPriorityAccuracy,
    correctTeamAssignments,
    overallTeamAccuracy,
    perCategoryMetrics,
    confusionMatrix,
    predictions,
  };
}

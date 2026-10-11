import fs from 'fs';
import path from 'path';
import { connectToDatabase, disconnectFromDatabase } from '../config/database';
import { getConfig } from '../config/env';
import { TicketModel } from '../models/Ticket';
import { classifyTicketMessage } from '../services/classifierService';
import { determineTicketPriority } from '../services/priorityService';
import { routeTicket } from '../services/routingService';
import { generateSummaryAndDraft } from '../services/draftService';

interface SeedTicketInput {
  ticketId: string;
  message: string;
}

async function seedDatabase(): Promise<void> {
  const config = getConfig();
  if (!config.mongodbUri) {
    console.error('[SEED] MONGODB_URI is not configured. Please set MONGODB_URI in backend/.env before seeding.');
    process.exit(1);
  }

  await connectToDatabase(config.mongodbUri);

  const devDataPath = path.resolve(__dirname, '../../sample_data/development_tickets.json');
  const ambDataPath = path.resolve(__dirname, '../../sample_data/ambiguous_examples.json');

  const devTickets = JSON.parse(fs.readFileSync(devDataPath, 'utf-8')) as SeedTicketInput[];
  const ambTickets = JSON.parse(fs.readFileSync(ambDataPath, 'utf-8')) as SeedTicketInput[];
  const allToSeed = [...devTickets.slice(0, 8), ...ambTickets.slice(0, 2)];

  let inserted = 0;
  let skipped = 0;

  for (const item of allToSeed) {
    const exists = await TicketModel.findOne({ ticketId: item.ticketId }).lean();
    if (exists) {
      skipped += 1;
      continue;
    }

    const classification = classifyTicketMessage(item.message);
    const priorityEval = determineTicketPriority(item.message, classification.category);
    const routing = routeTicket(
      classification.category,
      priorityEval.priority,
      classification.isUncertain
    );
    const { summary, draftResponse } = generateSummaryAndDraft({
      ticketId: item.ticketId,
      message: item.message,
      category: classification.category,
      priority: priorityEval.priority,
      assignedTeam: routing.assignedTeam,
      isUncertain: classification.isUncertain,
      matchedSignals: classification.matchedSignals,
    });

    await TicketModel.create({
      ticketId: item.ticketId,
      message: item.message,
      category: classification.category,
      priority: priorityEval.priority,
      assignedTeam: routing.assignedTeam,
      summary,
      draftResponse,
      confidence: classification.confidence,
      classificationExplanation: `${classification.explanation} ${priorityEval.priorityExplanation}`,
      matchedSignals: classification.matchedSignals,
      prioritySignals: priorityEval.prioritySignals,
      isUncertain: classification.isUncertain,
      reviewStatus: routing.reviewStatus,
    });
    inserted += 1;
  }

  console.log(`[SEED] Complete. Inserted: ${inserted}, Skipped existing: ${skipped}`);
  await disconnectFromDatabase();
}

seedDatabase().catch((err) => {
  console.error('[SEED] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

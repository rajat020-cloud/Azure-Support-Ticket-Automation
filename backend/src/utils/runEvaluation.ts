import { evaluateHeldOutDataset } from '../services/evaluationService';
import { TICKET_CATEGORIES } from '../models/Ticket';

function printEvaluationReport(): void {
  const report = evaluateHeldOutDataset(true);

  console.log('======================================================================');
  console.log(' PS04 — HELD-OUT CLASSIFIER & PRIORITY EVALUATION REPORT');
  console.log('======================================================================');
  console.log(`Dataset               : ${report.datasetName}`);
  console.log(`Evaluated At          : ${report.evaluatedAt}`);
  console.log(`Total Test Tickets    : ${report.totalTestTickets}`);
  console.log(
    `Category Accuracy     : ${report.correctCategoryPredictions}/${report.totalTestTickets} (${(
      report.overallCategoryAccuracy * 100
    ).toFixed(2)}%)`
  );
  console.log(
    `Priority Accuracy     : ${report.correctPriorityPredictions}/${report.totalTestTickets} (${(
      report.overallPriorityAccuracy * 100
    ).toFixed(2)}%)`
  );
  console.log(
    `Team Routing Accuracy : ${report.correctTeamAssignments}/${report.totalTestTickets} (${(
      report.overallTeamAccuracy * 100
    ).toFixed(2)}%)`
  );
  console.log('----------------------------------------------------------------------');
  console.log('PER-CATEGORY PERFORMANCE:');
  console.log(
    'Category    | Expected | Predicted | TP | FP | FN | Precision | Recall | F1 Score'
  );
  console.log(
    '------------|----------|-----------|----|----|----|-----------|--------|---------'
  );

  for (const metric of report.perCategoryMetrics) {
    console.log(
      `${metric.category.padEnd(11)} | ${String(metric.totalExpected).padEnd(8)} | ${String(
        metric.totalPredicted
      ).padEnd(9)} | ${String(metric.truePositives).padEnd(2)} | ${String(
        metric.falsePositives
      ).padEnd(2)} | ${String(metric.falseNegatives).padEnd(2)} | ${(
        metric.precision * 100
      )
        .toFixed(1)
        .padStart(8)}% | ${(metric.recall * 100).toFixed(1).padStart(5)}% | ${metric.f1Score.toFixed(
        4
      )}`
    );
  }

  console.log('----------------------------------------------------------------------');
  console.log('CONFUSION MATRIX (Rows = Actual Expected, Columns = Predicted):');
  const header = `Actual \\ Pred | ${TICKET_CATEGORIES.map((c) => c.padEnd(10)).join(' | ')}`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const actual of TICKET_CATEGORIES) {
    const row = TICKET_CATEGORIES.map((pred) =>
      String(report.confusionMatrix[actual][pred]).padEnd(10)
    ).join(' | ');
    console.log(`${actual.padEnd(13)} | ${row}`);
  }

  console.log('----------------------------------------------------------------------');
  console.log('INDIVIDUAL HELD-OUT TICKET PREDICTIONS:');
  for (const p of report.predictions || []) {
    const catMark = p.categoryCorrect ? 'PASS' : 'FAIL';
    const priMark = p.priorityCorrect ? 'PASS' : 'FAIL';
    console.log(
      `[${p.ticketId}] Category: ${p.predictedCategory} (expected ${p.expectedCategory}) [${catMark}] | Priority: ${p.predictedPriority} (expected ${p.expectedPriority}) [${priMark}] | Confidence: ${p.confidence.toFixed(
        2
      )}`
    );
  }
  console.log('======================================================================');
}

printEvaluationReport();

import { runRagasEval } from "../evals/ragas.ts";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("[ragas-ci] OPENAI_API_KEY unset — skipping eval");
    process.exit(0);
  }

  const scores = await runRagasEval({
    question: "What is the designated test phrase in the document?",
    answer: "The designated test phrase is AURORA-42.",
    contexts: ["RAG E2E fixture: the designated test phrase is AURORA-42 for retrieval checks."],
  });

  console.log("[ragas-ci]", scores);
  const min = Number(process.env.RAGAS_CI_MIN_SCORE ?? "0.35");
  if (scores.faithfulness < min || scores.answerRelevance < min) {
    console.error("[ragas-ci] faithfulness or answerRelevance below threshold", min);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import OpenAI from "openai";

export type RagasEvalInput = {
  question: string;
  answer: string;
  contexts: string[];
};

export type RagasScores = {
  faithfulness: number;
  answerRelevance: number;
  raw?: string;
};

/**
 * Lightweight RAGAS-style LLM-as-judge scores (0–1). Requires `OPENAI_API_KEY`.
 * Not a full RAGAS Python port; rubrics mirror faithfulness + answer relevance.
 */
export async function runRagasEval(input: RagasEvalInput): Promise<RagasScores> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for runRagasEval");
  }

  const client = new OpenAI({ apiKey });
  const contextBlock = input.contexts.join("\n---\n").slice(0, 12000);

  const prompt = `You are an evaluator. Given CONTEXTS, QUESTION, and ANSWER, output ONLY valid JSON with two floats between 0 and 1:
{
  "faithfulness": <does the answer stay grounded in the contexts without contradiction?>,
  "answerRelevance": <does the answer address the question?>
}

CONTEXTS:
${contextBlock}

QUESTION:
${input.question}

ANSWER:
${input.answer}`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { faithfulness?: number; answerRelevance?: number };
  const faithfulness = clamp01(parsed.faithfulness);
  const answerRelevance = clamp01(parsed.answerRelevance);
  return { faithfulness, answerRelevance, raw };
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

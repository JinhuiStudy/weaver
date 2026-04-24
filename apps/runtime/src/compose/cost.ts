/**
 * Rough neuron estimator for Workers AI calls. Cloudflare doesn't return a
 * billing figure in the call response, so we approximate:
 *
 *   tokens  ≈ (prompt_chars + completion_chars) / 4   (English-biased, fine for $0 metering)
 *   neurons ≈ tokens / 8                              (middle-of-the-road for Llama-3.3-70b)
 *
 * The exact cost shows up in Cloudflare's dashboard; this estimate is for
 * user-facing "50 left today" banners and Analytics Engine attribution. We
 * round up so a tiny call still costs at least 1 neuron.
 */

const CHARS_PER_TOKEN = 4;
const TOKENS_PER_NEURON = 8;

export interface NeuronsEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  neurons: number;
}

export function estimateNeurons(inputChars: number, outputChars: number): NeuronsEstimate {
  const inputTokens = Math.ceil(Math.max(0, inputChars) / CHARS_PER_TOKEN);
  const outputTokens = Math.ceil(Math.max(0, outputChars) / CHARS_PER_TOKEN);
  const totalTokens = inputTokens + outputTokens;
  const neurons = Math.max(1, Math.ceil(totalTokens / TOKENS_PER_NEURON));
  return { inputTokens, outputTokens, totalTokens, neurons };
}

/** Per-user Free tier cap — shared Workers AI pool dimensioned for ~200 DAU. */
export const NEURONS_DAILY_CAP = 50;

/** Independent of default answer models (e.g. gemma4:26b). */
export const DEFAULT_JUDGE_MODEL = 'qwen3.5:4b-q4_K_M';

export function resolveJudgeModel(): string {
  const model = (process.env.JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL).trim();
  if (!model) {
    throw new Error('JUDGE_MODEL is required (default: qwen2.5:32b — must differ from answer model).');
  }
  return model;
}

export function assertJudgeDiffersFromAnswerModel(args: {
  judgeModel: string;
  answerModel?: string;
}): void {
  const answerModel = (process.env.ANSWER_LLM_MODEL ?? args.answerModel ?? '').trim();
  if (!answerModel) return;
  if (args.judgeModel === answerModel && process.env.ALLOW_SAME_JUDGE !== '1') {
    throw new Error(
      `JUDGE_MODEL (${args.judgeModel}) must differ from answer model (${answerModel}). ` +
        'Use a separate judge model for calibration, or set ALLOW_SAME_JUDGE=1 (not recommended).',
    );
  }
}

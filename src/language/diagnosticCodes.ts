export const DiagnosticCode = {
  invalidInteractiveSyntaxes: 'playground.invalidInteractiveSyntaxes',
} as const;

export type DiagnosticCodes =
  (typeof DiagnosticCode)[keyof typeof DiagnosticCode];

export default DiagnosticCode;

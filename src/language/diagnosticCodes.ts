export const DIAGNOSTIC_CODES = {
  invalidInteractiveSyntaxes: 'playground.invalidInteractiveSyntaxes',
} as const;

export type DiagnosticCodes =
  (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

export default DIAGNOSTIC_CODES;

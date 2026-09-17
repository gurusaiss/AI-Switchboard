import type { UniversalTask } from '../lib/types';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/** Basic sanity check for balanced brackets/braces/parens - catches obviously truncated
 * or malformed code without needing a real parser per language. */
function hasBalancedDelimiters(text: string): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  for (const ch of text) {
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

export function validateOutput(task: UniversalTask, text: string): ValidationResult {
  if (!text || text.trim().length === 0) {
    return { ok: false, reason: 'Empty response' };
  }

  if (task.requiredCapabilities.includes('coding') || task.outputFormat === 'code') {
    if (!hasBalancedDelimiters(text)) {
      return { ok: false, reason: 'Code output has unbalanced brackets/braces/parens' };
    }
  }

  if (task.outputFormat === 'json') {
    const candidate = extractJsonCandidate(text);
    try {
      JSON.parse(candidate);
    } catch {
      return { ok: false, reason: 'Structured-output request did not produce valid JSON' };
    }
  }

  return { ok: true };
}

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

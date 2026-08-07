'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import {
  containsEmailSeparator,
  extractEmailsFromCsvText,
  isValidInviteEmail,
  mergeEmailChips,
  splitEmailTokens,
} from '@/lib/email-chips';
import { MAX_BULK_FOUNDER_INVITES } from '@/lib/event-dashboard';

type EmailChipInputProps = {
  value: string[];
  onChange: (emails: string[]) => void;
  inputId: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  limit?: number;
  showCsvUpload?: boolean;
};

/**
 * Invite-email entry that turns typed, pasted, or CSV-uploaded addresses into
 * removable chips. Commits on Enter, comma, space, tab, semicolon, and blur, so
 * a column copied from a spreadsheet lands as individual entries with no
 * format to learn. Invalid addresses stay visible and flagged for review.
 */
export function EmailChipInput({
  value,
  onChange,
  inputId,
  placeholder = 'founder@startup.com',
  autoFocus,
  disabled,
  limit = MAX_BULK_FOUNDER_INVITES,
  showCsvUpload = true,
}: EmailChipInputProps) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidCount = value.filter((email) => !isValidInviteEmail(email)).length;

  const commitTokens = (tokens: string[], sourceLabel?: string) => {
    if (!tokens.length) return;
    const { chips, overflow } = mergeEmailChips(value, tokens, limit);
    const added = chips.length - value.length;
    const parts: string[] = [];
    if (sourceLabel) {
      parts.push(
        added
          ? `Added ${added} address${added === 1 ? '' : 'es'} from ${sourceLabel}.`
          : `No new addresses found in ${sourceLabel}.`
      );
    }
    if (overflow) parts.push(`Only the first ${limit} addresses were kept.`);
    setNotice(parts.join(' '));
    if (added) onChange(chips);
  };

  const commitDraft = (text = draft) => {
    const tokens = splitEmailTokens(text);
    setDraft('');
    commitTokens(tokens);
  };

  const removeChip = (email: string) => {
    setNotice('');
    onChange(value.filter((entry) => entry !== email));
    inputRef.current?.focus();
  };

  const handleDraftChange = (text: string) => {
    // Mobile keyboards do not reliably emit keydown for separators, so commit
    // from the text itself whenever one appears.
    if (containsEmailSeparator(text)) {
      commitDraft(text);
      return;
    }
    setDraft(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && draft.trim()) {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && draft.trim()) {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      event.preventDefault();
      removeChip(value[value.length - 1]);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!containsEmailSeparator(text)) return;
    event.preventDefault();
    commitDraft(`${draft} ${text}`);
  };

  const handleCsvFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const emails = extractEmailsFromCsvText(await file.text());
      if (!emails.length) {
        setNotice(`No email addresses found in ${file.name}.`);
        return;
      }
      commitTokens(emails, file.name);
    } catch {
      setNotice(`Could not read ${file.name}. Try copying the addresses instead.`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        className="input-dark flex min-h-12 cursor-text flex-wrap items-center gap-1.5 py-2 focus-within:border-neon-cyan focus-within:ring-2 focus-within:ring-neon-cyan/20"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => {
          const valid = isValidInviteEmail(email);
          return (
            <span
              key={email}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm font-semibold ${
                valid
                  ? 'border-white/15 bg-white/[0.08] text-slate-100'
                  : 'border-roast/40 bg-roast/15 text-roast'
              }`}
              title={valid ? email : `${email} is not a valid email address`}
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  removeChip(email);
                }}
                aria-label={`Remove ${email}`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-current transition hover:bg-white/15"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => commitDraft()}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[10ch] flex-1 border-0 bg-transparent p-1 text-base font-semibold text-white outline-none placeholder:text-slate-500"
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs leading-5 text-slate-500">
          {[
            invalidCount
              ? `${invalidCount} invalid address${invalidCount === 1 ? '' : 'es'} — remove before sending.`
              : '',
            notice,
          ]
            .filter(Boolean)
            .join(' ') || 'Type or paste addresses — spreadsheet columns work too.'}
        </span>
        <span className="flex items-center gap-3">
          {value.length ? (
            <span className="text-xs font-bold text-slate-400">{value.length}/{limit}</span>
          ) : null}
          {showCsvUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(event) => handleCsvFile(event.target.files?.[0])}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-300 transition hover:border-neon-cyan/45 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
              </button>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { TravelerSlotId } from '../shared/travelerProfile';

export interface PollOption {
  id: string;
  text: string;
}

export interface GroupPoll {
  id: string;
  question: string;
  options: PollOption[];
  /** Voto espresso da ciascun posto (t1..t4) -> option.id */
  votes: Partial<Record<TravelerSlotId, string>>;
  closed: boolean;
  createdBy: string;
  createdBySlot: TravelerSlotId;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'seul2027:polls:v1';

function readLocal(): GroupPoll[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as GroupPoll[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: GroupPoll[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* niente */
  }
}

let pollsState: GroupPoll[] = readLocal();
let syncMode: 'cloud' | 'local' = 'local';
const listeners = new Set<() => void>();
let started = false;

function sortPolls(list: GroupPoll[]): GroupPoll[] {
  return [...list].sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

function emit() {
  pollsState = sortPolls(pollsState);
  writeLocal(pollsState);
  listeners.forEach((fn) => fn());
}

function sanitizePoll(p: GroupPoll): GroupPoll {
  const cleanOpts = p.options
    .map((o) => ({ id: o.id.slice(0, 20), text: o.text.trim().slice(0, 80) }))
    .filter((o) => o.text.length > 0)
    .slice(0, 4);
  const validIds = new Set(cleanOpts.map((o) => o.id));
  const cleanVotes: Partial<Record<TravelerSlotId, string>> = {};
  for (const s of ['t1', 't2', 't3', 't4'] as TravelerSlotId[]) {
    const v = p.votes[s];
    if (v && validIds.has(v)) cleanVotes[s] = v;
  }
  return {
    id: p.id.slice(0, 60),
    question: p.question.trim().slice(0, 120),
    options: cleanOpts,
    votes: cleanVotes,
    closed: !!p.closed,
    createdBy: p.createdBy.slice(0, 60),
    createdBySlot: p.createdBySlot,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

function ensureStarted() {
  if (started) return;
  started = true;
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    onSnapshot(
      collection(db, 'polls'),
      (snap) => {
        const byId = new Map<string, GroupPoll>();
        if (snap.metadata.fromCache) {
          for (const loc of pollsState) byId.set(loc.id, loc);
        }
        snap.docs.forEach((d) => {
          const remote = d.data() as GroupPoll;
          if (!remote || typeof remote.question !== 'string' || !Array.isArray(remote.options)) return;
          const cur = byId.get(d.id);
          if (!cur || (remote.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) {
            byId.set(d.id, { ...remote, id: d.id, votes: remote.votes ?? {} });
          }
        });
        // Conserva eventuali sondaggi creati localmente ma non ancora sincronizzati sul cloud
        for (const loc of pollsState) {
          if (!byId.has(loc.id) && Date.now() - loc.updatedAt < 60_000) {
            byId.set(loc.id, loc);
          }
        }
        pollsState = Array.from(byId.values());
        syncMode = 'cloud';
        emit();
      },
      () => {
        syncMode = 'local';
      }
    );
  } catch {
    syncMode = 'local';
  }
}

async function persistPoll(poll: GroupPoll): Promise<void> {
  const clean = sanitizePoll({ ...poll, updatedAt: Date.now() });
  const exists = pollsState.some((p) => p.id === clean.id);
  pollsState = exists ? pollsState.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...pollsState];
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await setDoc(doc(db, 'polls', clean.id), clean);
    syncMode = 'cloud';
  } catch {
    syncMode = 'local';
  }
}

export async function createPoll(
  question: string,
  optionTexts: string[],
  uid: string,
  slot: TravelerSlotId
): Promise<void> {
  const now = Date.now();
  const options: PollOption[] = optionTexts
    .map((t, i) => ({ id: `opt_${i + 1}`, text: t.trim() }))
    .filter((o) => o.text.length > 0)
    .slice(0, 4);
  if (!question.trim() || options.length < 2) return;
  const poll: GroupPoll = {
    id: `poll_${now}_${Math.random().toString(36).slice(2, 6)}`,
    question: question.trim(),
    options,
    votes: {},
    closed: false,
    createdBy: uid,
    createdBySlot: slot,
    createdAt: now,
    updatedAt: now
  };
  await persistPoll(poll);
}

export async function votePoll(pollId: string, slot: TravelerSlotId, optionId: string): Promise<void> {
  const cur = pollsState.find((p) => p.id === pollId);
  if (!cur || cur.closed) return;
  const nextVotes = { ...cur.votes };
  if (nextVotes[slot] === optionId) delete nextVotes[slot];
  else nextVotes[slot] = optionId;
  await persistPoll({ ...cur, votes: nextVotes });
}

export async function togglePollClosed(pollId: string): Promise<void> {
  const cur = pollsState.find((p) => p.id === pollId);
  if (!cur) return;
  await persistPoll({ ...cur, closed: !cur.closed });
}

export async function deletePoll(pollId: string): Promise<void> {
  pollsState = pollsState.filter((p) => p.id !== pollId);
  emit();
  if (!isFirebaseConfigured) return;
  try {
    const { db } = firebase();
    await deleteDoc(doc(db, 'polls', pollId));
  } catch {
    syncMode = 'local';
  }
}

export function usePolls(mySlot: TravelerSlotId | null): {
  polls: GroupPoll[];
  unvotedOpenCount: number;
  syncMode: 'cloud' | 'local';
} {
  ensureStarted();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const unvotedOpenCount = mySlot ? pollsState.filter((p) => !p.closed && !p.votes[mySlot]).length : 0;
  return { polls: pollsState, unvotedOpenCount, syncMode };
}

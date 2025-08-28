import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface EventRecord {
  id: number;
  title: string;
  description?: string;
  date: string; // e.g. "Feb 20, 2025"
  fullDate: string; // ISO date string
  time: string; // "5:00 PM - 7:00 PM"
  location: string;
  city: string;
  state: string;
  type: string;
  isOnline: boolean;
  organizer: string;
  attendees: number;
  maxAttendees: number;
  // removed isRsvpd persisted column; derive per user via event_rsvps
  isRsvpd: boolean;
  tags?: string[];
  skillLevel: string;
  created_by?: string | null;
}

const TABLE = 'events';
const RSVP_TABLE = 'event_rsvps';

// Internal row shape from PostgREST; using unknown to avoid any
function mapRowToEvent(row: Record<string, unknown>, isRsvpd = false): EventRecord {
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    date: row.date as string,
    fullDate: row.fullDate as string, // quoted column keeps camelCase
    time: row.time as string,
    location: row.location as string,
    city: row.city as string,
    state: row.state as string,
    type: row.type as string,
    isOnline: row.isonline as boolean, // lowercased in DB
    organizer: row.organizer as string,
    attendees: row.attendees as number,
    maxAttendees: row.maxattendees as number, // lowercased in DB
    isRsvpd,
    tags: (row.tags as string[] | null) ?? [],
    skillLevel: row.skilllevel as string, // lowercased in DB
    created_by: (row.created_by as string | null) ?? undefined,
  };
}

export async function fetchEvents(userId?: string | null): Promise<EventRecord[] | null> {
  try {
    const { data, error } = await supabase.from(TABLE).select('*').order('fullDate');
    if (error) throw error;
    const rows = (data as unknown as Record<string, unknown>[]) || [];

    if (!userId) return rows.map((r) => mapRowToEvent(r, false));

    const { data: rsvps, error: rsvpErr } = await supabase
      .from(RSVP_TABLE)
      .select('event_id')
      .eq('user_id', userId);
    if (rsvpErr) throw rsvpErr;
    const rsvpSet = new Set((rsvps || []).map((r) => (r as { event_id: number }).event_id));
    return rows.map((r) => {
      const id = r.id as number;
      return mapRowToEvent(r, rsvpSet.has(id));
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[events] fetch fallback', msg);
    return null;
  }
}

export interface NewEventInput {
  title: string;
  description?: string;
  fullDate: Date;
  time: string;
  location: string;
  city: string;
  state: string;
  type: string;
  isOnline: boolean;
  organizer: string;
  maxAttendees: number;
  tags: string[];
  skillLevel: string;
  created_by?: string | null;
}

export async function createEvent(
  input: NewEventInput,
  autoRsvpUserId?: string | null
): Promise<EventRecord | null> {
  try {
    // Require auth so RLS insert policy passes (auth.uid() = created_by)
    const { data: sessionRes } = await supabase.auth.getSession();
    const userId = sessionRes?.session?.user?.id ?? null;
    if (!userId) {
      throw new Error('You must be signed in to create an event.');
    }
    const payload = {
      // Use DB column names where PostgREST expects lowercased identifiers for unquoted columns
      title: input.title,
      description: input.description ?? null,
      date: input.fullDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      fullDate: input.fullDate.toISOString(), // quoted column name remains camelCase
      time: input.time,
      location: input.location,
      city: input.city,
      state: input.state,
      type: input.type,
      isonline: input.isOnline,
      organizer: input.organizer,
      attendees: 0,
      maxattendees: input.maxAttendees,
      tags: input.tags ?? [],
      skilllevel: input.skillLevel,
      created_by: userId,
    };
    const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
    if (error || !data) throw error;

    let isRsvpd = false;
    // Default RSVP to creator if not explicitly provided
    const rsvpUser = autoRsvpUserId === undefined ? userId : autoRsvpUserId;
    if (rsvpUser) {
      const { error: rsvpError } = await supabase
        .from(RSVP_TABLE)
        .insert({ event_id: (data as { id: number }).id, user_id: rsvpUser });
      if (!rsvpError) isRsvpd = true;
    }

    toast.success('Event created');
    const base = mapRowToEvent(data, isRsvpd);
    const record: EventRecord = base;
    return record;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`Event create failed: ${msg}`);
    console.warn('[events] create fallback', msg);
    return null;
  }
}

export async function toggleRsvp(
  event: EventRecord,
  userId?: string | null
): Promise<EventRecord | null> {
  if (!userId) return null;
  try {
    const currentlyRsvpd = event.isRsvpd;
    if (currentlyRsvpd) {
      const { error } = await supabase
        .from(RSVP_TABLE)
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', userId);
      if (error) throw error;
      return { ...event, isRsvpd: false, attendees: Math.max(0, event.attendees - 1) };
    } else {
      const { error } = await supabase
        .from(RSVP_TABLE)
        .insert({ event_id: event.id, user_id: userId });
      if (error) throw error;
      return { ...event, isRsvpd: true, attendees: event.attendees + 1 };
    }
  } catch (e) {
    console.warn('[events] toggle rsvp fallback', e);
    return null;
  }
}

export function seedInstructions() {
  return `-- events & event_rsvps handled in migration 002`;
}

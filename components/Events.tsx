import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Clock, Users, Plus, Globe } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  fetchEvents as fetchEventsRemote,
  createEvent as createEventRemote,
  toggleRsvp as toggleRsvpRemote,
  type EventRecord,
} from '@/services/events';
import { toast } from 'sonner';

// Mock events data (expanded with more variety)
const mockEvents = [
  {
    id: 1,
    title: 'Arduino Workshop for Beginners',
    date: 'Feb 20, 2025',
    fullDate: new Date('2025-02-20'),
    time: '5:00 PM - 7:00 PM',
    location: 'Central High School, Gym',
    city: 'Seattle',
    state: 'WA',
    type: 'workshop',
    isOnline: false,
    description:
      'Learn the basics of Arduino programming and circuit building. Perfect for beginners!',
    organizer: 'FIRST Robotics Seattle',
    attendees: 24,
    maxAttendees: 40,
    isRsvpd: false,
    tags: ['Arduino', 'Programming', 'Beginners'],
    skillLevel: 'beginner',
  },
  {
    id: 2,
    title: 'FRC Off-Season Competition',
    date: 'Mar 15, 2025',
    fullDate: new Date('2025-03-15'),
    time: '9:00 AM - 5:00 PM',
    location: 'Seattle Convention Center',
    city: 'Seattle',
    state: 'WA',
    type: 'competition',
    isOnline: false,
    description: 'Annual off-season competition featuring teams from Washington and Oregon.',
    organizer: 'Washington FIRST',
    attendees: 156,
    maxAttendees: 200,
    isRsvpd: true,
    tags: ['FRC', 'Competition', 'Off-Season'],
    skillLevel: 'all',
  },
  {
    id: 3,
    title: 'Computer Vision in Robotics - Webinar',
    date: 'Feb 18, 2025',
    fullDate: new Date('2025-02-18'),
    time: '7:00 PM - 8:30 PM',
    location: 'Online (Zoom)',
    city: 'Online',
    state: 'Online',
    type: 'webinar',
    isOnline: true,
    description:
      'Deep dive into computer vision techniques for autonomous robots. Guest speaker from industry.',
    organizer: 'RoboEducators Alliance',
    attendees: 89,
    maxAttendees: 100,
    isRsvpd: false,
    tags: ['Computer Vision', 'AI', 'Advanced'],
    skillLevel: 'advanced',
  },
  {
    id: 4,
    title: 'Robot Parts Swap Meet',
    date: 'Feb 22, 2025',
    fullDate: new Date('2025-02-22'),
    time: '10:00 AM - 2:00 PM',
    location: 'Bellevue Community Center',
    city: 'Bellevue',
    state: 'WA',
    type: 'meetup',
    isOnline: false,
    description:
      "Bring parts you don't need and find parts you do! Perfect for budget-conscious teams.",
    organizer: 'Local Teams Network',
    attendees: 31,
    maxAttendees: 50,
    isRsvpd: false,
    tags: ['Parts', 'Trading', 'Community'],
    skillLevel: 'all',
  },
  {
    id: 5,
    title: 'Mentor Training Session',
    date: 'Mar 1, 2025',
    fullDate: new Date('2025-03-01'),
    time: '6:00 PM - 8:00 PM',
    location: 'University of Washington',
    city: 'Seattle',
    state: 'WA',
    type: 'training',
    isOnline: false,
    description:
      'Training session for new and experienced mentors. Learn effective mentoring techniques.',
    organizer: 'FIRST Mentors WA',
    attendees: 15,
    maxAttendees: 30,
    isRsvpd: false,
    tags: ['Mentoring', 'Leadership', 'Training'],
    skillLevel: 'all',
  },
  {
    id: 6,
    title: 'FTC Java Programming Bootcamp',
    date: 'Feb 25, 2025',
    fullDate: new Date('2025-02-25'),
    time: '9:00 AM - 4:00 PM',
    location: 'Portland Tech Center',
    city: 'Portland',
    state: 'OR',
    type: 'workshop',
    isOnline: false,
    description:
      'Intensive day-long workshop covering Java programming for FTC robots. Includes hands-on coding exercises.',
    organizer: 'Oregon FTC Alliance',
    attendees: 18,
    maxAttendees: 25,
    isRsvpd: false,
    tags: ['FTC', 'Java', 'Programming', 'Bootcamp'],
    skillLevel: 'intermediate',
  },
  {
    id: 7,
    title: 'CAD Design Challenge - Online',
    date: 'Feb 28, 2025',
    fullDate: new Date('2025-02-28'),
    time: '3:00 PM - 6:00 PM',
    location: 'Online (Discord)',
    city: 'Online',
    state: 'Online',
    type: 'competition',
    isOnline: true,
    description:
      'Compete in real-time CAD design challenges. Win prizes and showcase your design skills!',
    organizer: 'CAD Masters Guild',
    attendees: 67,
    maxAttendees: 100,
    isRsvpd: true,
    tags: ['CAD', 'Design', 'Challenge', 'Online'],
    skillLevel: 'intermediate',
  },
];

const eventTypes = [
  { id: 'all', name: 'All Events', color: 'bg-gray-500' },
  { id: 'competition', name: 'Competition', color: 'bg-red-500' },
  { id: 'workshop', name: 'Workshop', color: 'bg-blue-500' },
  { id: 'webinar', name: 'Webinar', color: 'bg-green-500' },
  { id: 'meetup', name: 'Meetup', color: 'bg-purple-500' },
  { id: 'training', name: 'Training', color: 'bg-yellow-500' },
];

const sortOptions = [
  { id: 'date', label: 'Upcoming First' },
  { id: 'popular', label: 'Most Popular' },
  { id: 'nearby', label: 'Nearby First' },
  { id: 'rsvpd', label: 'My Events First' },
];

const skillLevels = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'all', label: 'All Levels' },
];

interface UserLike {
  id?: string;
  user_metadata?: { full_name?: string };
}
export function Events({ user }: { user?: UserLike }) {
  const [selectedType, setSelectedType] = useState('all');
  // Local normalized event type ensures fullDate is always Date
  type LocalEvent = Omit<EventRecord, 'fullDate'> & { fullDate: Date };
  type UnknownEvent = Partial<EventRecord> & { id?: number; fullDate?: string | Date };
  const normalize = useCallback((value: UnknownEvent): LocalEvent => {
    const raw: UnknownEvent = value || {};
    const fdSource = raw.fullDate;
    const fullDate: Date =
      fdSource && typeof fdSource === 'object' && 'getTime' in (fdSource as object)
        ? (fdSource as Date)
        : fdSource
          ? new Date(fdSource as string)
          : new Date();
    return {
      id: (raw.id as number) ?? Date.now(),
      title: raw.title || 'Untitled',
      description: raw.description || '',
      date:
        raw.date ||
        fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      fullDate,
      time: (raw.time as string) || '',
      location: raw.location || '',
      city: raw.city || '',
      state: raw.state || '',
      type: raw.type || 'meetup',
      isOnline: !!raw.isOnline,
      organizer: raw.organizer || 'Unknown',
      attendees: raw.attendees ?? 0,
      maxAttendees: raw.maxAttendees ?? 100,
      isRsvpd: !!raw.isRsvpd,
      tags: raw.tags || [],
      skillLevel: raw.skillLevel || 'all',
      created_by: raw.created_by || null,
    };
  }, []);
  const [events, setEvents] = useState<LocalEvent[]>(() =>
    mockEvents.map((ev) => normalize({ ...ev, fullDate: ev.fullDate.toISOString() }))
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [showCreate, setShowCreate] = useState(false);

  // Create event form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(''); // YYYY-MM-DD
  const [newStart, setNewStart] = useState(''); // HH:MM
  const [newEnd, setNewEnd] = useState('');
  const [newFormat, setNewFormat] = useState<'in-person' | 'online' | 'hybrid'>('in-person');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueState, setVenueState] = useState('');
  const [onlinePlatform, setOnlinePlatform] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [formSkillLevel, setFormSkillLevel] = useState('all');
  const [formTags, setFormTags] = useState(''); // comma separated
  const [maxAttendeesInput, setMaxAttendeesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedSkillLevels, setSelectedSkillLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState('');
  const [eventFormat, setEventFormat] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');

  // Get unique filter options
  const allLocations = useMemo(() => {
    const locationCounts: Record<string, number> = {};
    events.forEach((event) => {
      if (event.state !== 'Online') {
        locationCounts[event.state] = (locationCounts[event.state] || 0) + 1;
      }
    });
    return Object.entries(locationCounts).map(([location, count]) => ({
      id: location,
      label: location,
      count: count as number,
    }));
  }, [events]);

  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    events.forEach((event) => {
      event.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts).map(([tag, count]) => ({
      id: tag,
      label: tag,
      count: count as number,
    }));
  }, [events]);

  const skillLevelOptions = skillLevels.map((level) => ({
    ...level,
    count: events.filter((e) => e.skillLevel === level.id).length,
  }));

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      // Type filter
      if (selectedType !== 'all' && event.type !== selectedType) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = event.title.toLowerCase().includes(query);
        const matchesDescription = (event.description || '').toLowerCase().includes(query);
        const matchesOrganizer = event.organizer.toLowerCase().includes(query);
        const matchesLocation = event.location.toLowerCase().includes(query);
        const matchesTags = event.tags?.some((tag) => tag.toLowerCase().includes(query));

        if (
          !matchesTitle &&
          !matchesDescription &&
          !matchesOrganizer &&
          !matchesLocation &&
          !matchesTags
        ) {
          return false;
        }
      }

      // Location filter
      if (selectedLocations.length > 0 && !selectedLocations.includes(event.state)) {
        return false;
      }

      // Skill level filter
      if (selectedSkillLevels.length > 0 && !selectedSkillLevels.includes(event.skillLevel)) {
        return false;
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const hasSelectedTags = selectedTags.some((tag) => event.tags?.includes(tag));
        if (!hasSelectedTags) return false;
      }

      // Date range filter
      if (dateRange) {
        const now = new Date();
        const eventDate =
          event.fullDate instanceof Date ? event.fullDate : new Date(event.fullDate);

        switch (dateRange) {
          case 'today': {
            if (eventDate.toDateString() !== now.toDateString()) return false;
            break;
          }
          case 'week': {
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (eventDate > weekFromNow) return false;
            break;
          }
          case 'month': {
            const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (eventDate > monthFromNow) return false;
            break;
          }
        }
      }

      // Event format filter
      if (eventFormat === 'online' && !event.isOnline) return false;
      if (eventFormat === 'in-person' && event.isOnline) return false;

      // Availability filter
      if (availabilityFilter === 'available' && event.attendees >= event.maxAttendees) return false;
      if (availabilityFilter === 'rsvpd' && !event.isRsvpd) return false;

      return true;
    });

    // Sort events
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.attendees - a.attendees);
        break;
      case 'nearby':
        filtered.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
        break;
      case 'rsvpd':
        filtered.sort((a, b) => {
          if (a.isRsvpd && !b.isRsvpd) return -1;
          if (!a.isRsvpd && b.isRsvpd) return 1;
          return a.fullDate.getTime() - b.fullDate.getTime();
        });
        break;
      default: // date
        filtered.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    }

    return filtered;
  }, [
    events,
    selectedType,
    searchQuery,
    selectedLocations,
    selectedSkillLevels,
    selectedTags,
    dateRange,
    eventFormat,
    availabilityFilter,
    sortBy,
  ]);

  // Get active filters
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedType !== 'all') {
      const type = eventTypes.find((t) => t.id === selectedType);
      if (type) filters.push(type.name);
    }
    if (selectedLocations.length > 0) filters.push(...selectedLocations);
    if (selectedSkillLevels.length > 0)
      filters.push(
        ...selectedSkillLevels
          .map((level) => skillLevels.find((l) => l.id === level)?.label)
          .filter(Boolean)
      );
    if (selectedTags.length > 0) filters.push(...selectedTags);
    if (dateRange) filters.push(`Next ${dateRange}`);
    if (eventFormat) filters.push(eventFormat === 'online' ? 'Online' : 'In-person');
    if (availabilityFilter)
      filters.push(availabilityFilter === 'available' ? 'Available spots' : 'My events');
    return filters;
  }, [
    selectedType,
    selectedLocations,
    selectedSkillLevels,
    selectedTags,
    dateRange,
    eventFormat,
    availabilityFilter,
  ]);

  const filterSections = [
    {
      id: 'locations',
      title: 'Location',
      icon: MapPin,
      type: 'checkbox' as const,
      options: allLocations,
      value: selectedLocations,
    },
    {
      id: 'skillLevels',
      title: 'Skill Level',
      type: 'checkbox' as const,
      options: skillLevelOptions,
      value: selectedSkillLevels,
    },
    {
      id: 'tags',
      title: 'Topics',
      type: 'checkbox' as const,
      options: allTags,
      value: selectedTags,
    },
    {
      id: 'dateRange',
      title: 'Time Range',
      icon: Calendar,
      type: 'select' as const,
      options: [
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'Next 7 days' },
        { id: 'month', label: 'Next 30 days' },
      ],
      value: dateRange,
      placeholder: 'Any time',
    },
    {
      id: 'format',
      title: 'Format',
      icon: Globe,
      type: 'select' as const,
      options: [
        { id: 'online', label: 'Online only' },
        { id: 'in-person', label: 'In-person only' },
      ],
      value: eventFormat,
      placeholder: 'Any format',
    },
    {
      id: 'availability',
      title: 'Availability',
      type: 'select' as const,
      options: [
        { id: 'available', label: 'Has available spots' },
        { id: 'rsvpd', label: "Events I'm attending" },
      ],
      value: availabilityFilter,
      placeholder: 'All events',
    },
  ];

  const getEventTypeColor = (type: string) => {
    const eventType = eventTypes.find((t) => t.id === type);
    return eventType?.color || 'bg-gray-500';
  };

  const handleRsvp = async (eventId: number) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    // optimistic toggle
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, isRsvpd: !e.isRsvpd, attendees: e.isRsvpd ? e.attendees - 1 : e.attendees + 1 }
          : e
      )
    );
    const updated = await toggleRsvpRemote(
      {
        id: target.id,
        title: target.title,
        description: target.description,
        date: target.date,
        fullDate: target.fullDate.toISOString(),
        time: target.time,
        location: target.location,
        city: target.city,
        state: target.state,
        type: target.type,
        isOnline: target.isOnline,
        organizer: target.organizer,
        attendees: target.attendees,
        maxAttendees: target.maxAttendees,
        isRsvpd: target.isRsvpd,
        tags: target.tags,
        skillLevel: target.skillLevel,
        created_by: target.created_by || null,
      },
      user?.id
    );
    if (updated) {
      const norm = normalize(updated);
      setEvents((prev) => prev.map((e) => (e.id === eventId ? norm : e)));
    } else {
      // rollback on failure
      setEvents((prev) => prev.map((e) => (e.id === eventId ? target : e)));
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchEventsRemote(user?.id)
      .then((remote) => {
        if (remote && active) setEvents(remote.map(normalize));
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [normalize, user?.id]);

  const handleFilterChange = (sectionId: string, value: string | string[]) => {
    switch (sectionId) {
      case 'locations':
        setSelectedLocations(value as string[]);
        break;
      case 'skillLevels':
        setSelectedSkillLevels(value as string[]);
        break;
      case 'tags':
        setSelectedTags(value as string[]);
        break;
      case 'dateRange':
        setDateRange(value as string);
        break;
      case 'format':
        setEventFormat(value as string);
        break;
      case 'availability':
        setAvailabilityFilter(value as string);
        break;
    }
  };

  const clearFilters = () => {
    setSelectedType('all');
    setSelectedLocations([]);
    setSelectedSkillLevels([]);
    setSelectedTags([]);
    setDateRange('');
    setEventFormat('');
    setAvailabilityFilter('');
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white p-4">
        {showCreate ? (
          <div className="mb-2 flex items-center justify-between">
            <h2>Create Event</h2>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between">
            <h2>Events & Meetups</h2>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1 size-4" />
              Create Event
            </Button>
          </div>
        )}

        {!showCreate && (
          <SearchBar
            placeholder="Search events, organizers, locations..."
            onSearch={setSearchQuery}
            onFilterToggle={() => setShowFilters(!showFilters)}
            showFilters={true}
            activeFilters={activeFilters as string[]}
            onClearFilters={clearFilters}
          />
        )}

        {!showCreate && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {eventTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`rounded-full px-3 py-1 text-sm whitespace-nowrap transition-colors ${
                  selectedType === type.id
                    ? 'bg-teal-100 text-teal-800 border-2 border-teal-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>
        )}

        {!showCreate && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
            </p>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!showCreate && (
        <div className="px-4">
          <FilterPanel
            sections={filterSections}
            onFilterChange={handleFilterChange}
            onApplyFilters={() => setShowFilters(false)}
            onClearFilters={clearFilters}
            isVisible={showFilters}
          />
        </div>
      )}

      {!showCreate && loading && (
        <div className="p-4 text-sm text-muted-foreground">Loading events…</div>
      )}
      {!showCreate && !loading && (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto mb-4 size-12 text-gray-400" />
              <h3>No events found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery || activeFilters.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'No events match your current filter. Try selecting a different category.'}
              </p>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setSearchQuery('');
                  clearFilters();
                }}
              >
                {searchQuery || activeFilters.length > 0
                  ? 'Clear Search & Filters'
                  : 'View All Events'}
              </Button>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <Card key={event.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`size-2 rounded-full ${getEventTypeColor(event.type)}`} />
                      <Badge variant="secondary" className="text-xs capitalize">
                        {event.type}
                      </Badge>
                      {event.isOnline && (
                        <Badge variant="outline" className="text-xs">
                          Online
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {event.skillLevel}
                      </Badge>
                      {event.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {event.isRsvpd && (
                      <Badge className="bg-green-100 text-green-800">RSVP&apos;d</Badge>
                    )}
                  </div>

                  <h3 className="mb-2 line-clamp-2 font-semibold">{event.title}</h3>
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                    {event.description}
                  </p>

                  {/* Event Details */}
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 size-4" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 size-4" />
                      <span>{event.time}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {event.isOnline ? (
                        <Globe className="mr-2 size-4" />
                      ) : (
                        <MapPin className="mr-2 size-4" />
                      )}
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="mr-2 size-4" />
                      <span>
                        {event.attendees}/{event.maxAttendees} attending
                      </span>
                      {event.attendees >= event.maxAttendees && (
                        <Badge variant="outline" className="ml-2 text-xs text-red-600">
                          Full
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">by {event.organizer}</p>
                    <Button
                      size="sm"
                      variant={event.isRsvpd ? 'outline' : 'default'}
                      className={event.isRsvpd ? '' : 'bg-teal-600 hover:bg-teal-700'}
                      onClick={() => handleRsvp(event.id)}
                      disabled={!event.isRsvpd && event.attendees >= event.maxAttendees}
                    >
                      {event.isRsvpd
                        ? 'Cancel RSVP'
                        : event.attendees >= event.maxAttendees
                          ? 'Full'
                          : 'RSVP'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // Basic validation
            const errs: string[] = [];
            if (!newTitle.trim()) errs.push('Title');
            if (!newDate) errs.push('Date');
            if (!newStart) errs.push('Start time');
            if (newFormat !== 'online' && (!venueCity || !venueState)) errs.push('City/State');
            if (newFormat !== 'in-person' && !onlineUrl.trim()) errs.push('Online URL');
            const parsedMax = maxAttendeesInput ? parseInt(maxAttendeesInput, 10) : undefined;
            if (
              maxAttendeesInput &&
              (!Number.isFinite(parsedMax as number) || (parsedMax as number) <= 0)
            ) {
              errs.push('Max attendees must be a positive number');
            }
            if (errs.length) {
              alert('Missing required: ' + errs.join(', '));
              return;
            }
            if (!user?.id) {
              toast.error('Please sign in to create events.');
              return;
            }
            setSubmitting(true);
            const id = Math.max(0, ...events.map((e) => e.id)) + 1;
            const dateObj = new Date(newDate);
            if (Number.isNaN(dateObj.getTime())) {
              alert('Invalid date');
              return;
            }
            const timeRange = newEnd ? `${newStart} - ${newEnd}` : newStart;
            const isOnline = newFormat !== 'in-person';
            const location =
              newFormat === 'online'
                ? onlinePlatform
                  ? `${onlinePlatform} (${onlineUrl})`
                  : onlineUrl
                : `${venueName || ''}${venueName ? ', ' : ''}${venueCity}${venueState ? ', ' + venueState : ''}`;
            const tags = formTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            const safeMax =
              maxAttendeesInput && Number.isFinite(parsedMax as number) && (parsedMax as number) > 0
                ? (parsedMax as number)
                : 100;
            const localEvent: LocalEvent = normalize({
              id,
              title: newTitle.trim(),
              date: dateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              fullDate: dateObj.toISOString(),
              time: timeRange,
              location,
              city: venueCity || (isOnline ? 'Online' : ''),
              state: venueState || (isOnline ? 'Online' : ''),
              type: 'meetup',
              isOnline,
              description: newDescription.trim(),
              organizer: user?.user_metadata?.full_name || 'You',
              attendees: 0,
              maxAttendees: safeMax,
              isRsvpd: true,
              tags,
              skillLevel: formSkillLevel,
            } as EventRecord);
            // optimistic add
            setEvents((prev) => [...prev, localEvent]);
            // attempt remote create
            try {
              const remote = await createEventRemote({
                title: localEvent.title,
                description: localEvent.description || '',
                fullDate: dateObj,
                time: localEvent.time,
                location: localEvent.location,
                city: localEvent.city,
                state: localEvent.state,
                type: localEvent.type,
                isOnline: localEvent.isOnline,
                organizer: localEvent.organizer || 'Unknown',
                maxAttendees: safeMax,
                tags: localEvent.tags || [],
                skillLevel: localEvent.skillLevel,
              });
              if (remote) {
                setEvents((prev) => prev.map((ev) => (ev.id === id ? normalize(remote) : ev)));
                toast.success('Event created');
                setShowCreate(false);
                // Reset form
                setNewTitle('');
                setNewDescription('');
                setNewDate('');
                setNewStart('');
                setNewEnd('');
                setVenueName('');
                setVenueAddress('');
                setVenueCity('');
                setVenueState('');
                setOnlinePlatform('');
                setOnlineUrl('');
                setFormTags('');
                setMaxAttendeesInput('');
                setFormSkillLevel('all');
                setNewFormat('in-person');
              } else {
                // Remote failed silently; roll back optimistic add
                setEvents((prev) => prev.filter((ev) => ev.id !== id));
                toast.error('Failed to save event.');
              }
            } catch (err) {
              // Remote error; roll back optimistic add
              setEvents((prev) => prev.filter((ev) => ev.id !== id));
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`Failed to save event: ${msg}`);
            } finally {
              setSubmitting(false);
            }
          }}
          className="flex-1 space-y-4 overflow-y-auto p-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event title"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is this event about?"
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date *</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Time *</label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Time</label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Format *</label>
              <Select
                value={newFormat}
                onValueChange={(v: 'in-person' | 'online' | 'hybrid') => setNewFormat(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">In-person</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(newFormat === 'in-person' || newFormat === 'hybrid') && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Location (In-person){newFormat === 'in-person' ? ' *' : ''}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Venue Name</label>
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Venue / School"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Address</label>
                  <Input
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">City *</label>
                  <Input value={venueCity} onChange={(e) => setVenueCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">State *</label>
                  <Input
                    value={venueState}
                    onChange={(e) => setVenueState(e.target.value)}
                    placeholder="WA"
                  />
                </div>
              </div>
            </div>
          )}
          {(newFormat === 'online' || newFormat === 'hybrid') && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Online Access {newFormat === 'online' ? ' *' : ''}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Platform</label>
                  <Input
                    value={onlinePlatform}
                    onChange={(e) => setOnlinePlatform(e.target.value)}
                    placeholder="Zoom / Discord / etc"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Join URL *</label>
                  <Input
                    value={onlineUrl}
                    onChange={(e) => setOnlineUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Skill Level</label>
              <Select value={formSkillLevel} onValueChange={setFormSkillLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {skillLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Max Attendees</label>
              <Input
                type="number"
                min={1}
                value={maxAttendeesInput}
                onChange={(e) => setMaxAttendeesInput(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <Input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="FRC, Workshop"
            />
          </div>
          <div className="sticky bottom-0 flex gap-2 border-t bg-white p-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreate(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

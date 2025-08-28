import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Home, MessageSquare, Calendar, BookOpen, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { NewsFeed } from './NewsFeed';
import { Forums } from './Forums';
import { Events } from './Events';
import { Learn } from './Learn';
import { Profile } from './Profile';
import { UserPreferencesProvider, useUserPreferences } from './UserPreferencesContext';
import { Toaster } from './ui/sonner';
import { Button } from './ui/button';
import { getNewCounts, setLastSeen } from '@/services/notifications';
import OnboardingInterests from './OnboardingInterests';
import { fetchUserProfile } from '@/services/userProfiles';

// Lightweight gate that shows the onboarding interests overlay for users without interests
function OnboardingGate({ userId, displayName }: { userId: string; displayName?: string }) {
  const { preferences } = useUserPreferences();
  const [show, setShow] = useState(false);
  const [initialInterests, setInitialInterests] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const doneKey = `rh:onboard.done:${userId}`;
        if (localStorage.getItem(doneKey)) {
          if (!cancelled) setChecked(true);
          return;
        }
        // If local preferences already have interests, skip overlay
        if (preferences.interests && preferences.interests.length > 0) {
          if (!cancelled) setChecked(true);
          return;
        }
        const rec = await fetchUserProfile(userId);
        const ints = rec?.interests || [];
        if (!cancelled) {
          if (ints.length === 0) {
            setInitialInterests([]);
            setShow(true);
          }
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId, preferences.interests]);

  if (!checked) return null;
  if (!show) return null;

  return (
    <OnboardingInterests
      userId={userId}
      displayName={displayName}
      initialInterests={initialInterests}
      onComplete={() => {
        try {
          localStorage.setItem(`rh:onboard.done:${userId}`, new Date().toISOString());
        } catch {
          /* ignore */
        }
        setShow(false);
      }}
    />
  );
}

const tabs = [
  { id: 'feed', label: 'News', icon: Home, component: NewsFeed },
  { id: 'forums', label: 'Forums', icon: MessageSquare, component: Forums },
  { id: 'events', label: 'Events', icon: Calendar, component: Events },
  { id: 'learn', label: 'Learn', icon: BookOpen, component: Learn },
  { id: 'profile', label: 'Profile', icon: UserIcon, component: Profile },
];

interface MainAppProps {
  user: User | null;
  onLogout?: () => void;
}

export function MainApp({ user, onLogout }: MainAppProps) {
  const [activeTab, setActiveTab] = useState('feed');
  const [counts, setCounts] = useState<{ feedCount: number; forumCount: number }>({
    feedCount: 0,
    forumCount: 0,
  });
  // Refresh new-content counts periodically
  useEffect(() => {
    let cancelled = false;
    const uid = user?.id || null;
    const load = async () => {
      const c = await getNewCounts(uid);
      if (!cancelled) setCounts(c);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user?.id]);

  // When switching tabs, consider updating last seen to reduce noise
  useEffect(() => {
    // Mark last seen when user visits feed or forums
    if (activeTab === 'feed' || activeTab === 'forums') {
      setLastSeen(new Date());
      setCounts({ feedCount: 0, forumCount: 0 });
    }
  }, [activeTab]);
  // feed share handled inline now
  // forums ask handled inline now

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component || NewsFeed;

  // Derive a display name & avatar URL from common provider metadata keys
  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    (user?.user_metadata?.user_name as string) ||
    (user?.user_metadata?.preferred_username as string) ||
    (user?.email ? user.email.split('@')[0] : 'User');

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string) ||
    (user?.user_metadata?.picture as string) ||
    (user?.user_metadata?.avatar as string) ||
    (user?.user_metadata?.image as string) ||
    '';

  const initials = displayName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

  return (
    <UserPreferencesProvider>
      <div className="flex h-screen flex-col bg-background">
        {/* Global toast notifications */}
        <Toaster position="top-center" richColors closeButton />
        {/* Onboarding interests overlay for new users */}
        {user?.id && <OnboardingGate userId={user.id} displayName={displayName} />}
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h1 className="text-xl font-bold text-teal-600">Robotics Hub</h1>
          <div className="flex items-center gap-3">
            {/* feed share button moved into HomeFeed */}
            {/* forums ask button moved inside Forums component */}
            {/* User identity */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="text-right leading-tight">
                <p className="max-w-[140px] truncate text-xs font-medium text-gray-700">
                  {displayName}
                </p>
                <p className="text-[10px] text-gray-400">{user?.email}</p>
              </div>
              <Avatar className="size-9 border border-gray-200">
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                )}
                <AvatarFallback className="text-xs font-semibold uppercase">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLogout?.()}
              className="text-xs"
              title="Sign out to test other providers"
            >
              Sign out
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ActiveComponent user={user || undefined} onLogout={onLogout} />
        </div>

        {/* Bottom Tab Navigation */}
        <div className="safe-area-bottom border-t border-gray-200 bg-white p-2">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center p-2 ${
                    isActive ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className={`mb-1 size-6 ${isActive ? 'fill-current' : ''}`} />
                  <span className="relative truncate text-xs">
                    {tab.label}
                    {tab.id === 'feed' && counts.feedCount > 0 && (
                      <span className="absolute -right-4 -top-3 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] text-white">
                        {counts.feedCount}
                      </span>
                    )}
                    {tab.id === 'forums' && counts.forumCount > 0 && (
                      <span className="absolute -right-4 -top-3 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] text-white">
                        {counts.forumCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* New Post Modal */}
        {/* Feed Share Modal */}
        {/* feed share modal removed */}
        {/* forums question modal removed */}
      </div>
    </UserPreferencesProvider>
  );
}

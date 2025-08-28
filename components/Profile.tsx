import React, { useState, useEffect } from 'react';
import { LogOut, Edit3, MapPin, Users, MessageSquare, Heart, X, Save } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TeamFinder } from './TeamFinder';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useUserPreferences } from './UserPreferencesContext';
import { Switch } from './ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import {
  fetchUserProfile,
  upsertUserProfile,
  updateAvatar,
  sendTestDigest,
} from '@/services/userProfiles';
import { getSavedItems } from '@/services/engagement';
import { getSavedNews } from '@/services/news';
import { fetchForumThreadsByIds } from '@/services/forumThreads';

// Mock user posts
const mockUserPosts = [
  {
    id: 1,
    title: "Our Team's First Autonomous Code",
    description:
      "Finally got our robot to navigate autonomously! Still needs tweaking but it's a great start.",
    timestamp: '2 days ago',
    likes: 15,
    comments: 8,
    type: 'project',
  },
  {
    id: 2,
    title: 'Help with Servo Motor Control',
    description: "Posted in Programming forum about servo motor control issues we've been having.",
    timestamp: '5 days ago',
    likes: 0,
    comments: 12,
    type: 'forum',
  },
  {
    id: 3,
    title: 'Swerve Drive Testing Results',
    description: 'Shared our swerve drive testing results and lessons learned.',
    timestamp: '1 week ago',
    likes: 23,
    comments: 6,
    type: 'project',
  },
];

// Mock badges/achievements
const mockBadges = [
  { id: 1, name: 'First Post', icon: '🎯', description: 'Shared your first project' },
  { id: 2, name: 'Helper', icon: '🤝', description: 'Answered 5 forum questions' },
  { id: 3, name: 'Popular Post', icon: '⭐', description: 'Got 20+ likes on a post' },
];

interface ProfileProps {
  user?: { id?: string; name?: string; avatar?: string; team?: string; location?: string };
  onLogout?: () => void;
}
export function Profile({ user, onLogout }: ProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [userPosts] = useState(mockUserPosts);
  const [badges] = useState(mockBadges);
  const { preferences, updatePreferences } = useUserPreferences();
  // Inline editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(
    preferences.displayNameOverride || user?.name || ''
  );
  const [draftBio, setDraftBio] = useState(preferences.bio || '');
  const [draftLocation, setDraftLocation] = useState(preferences.location || '');
  const [draftInterests, setDraftInterests] = useState(preferences.interests.join(', '));
  const [draftFollowedTags, setDraftFollowedTags] = useState('');
  type DigestFreq = 'daily' | 'weekly' | 'off';
  const [draftEmailFrequency, setDraftEmailFrequency] = useState<DigestFreq>('weekly');
  const [lastDigestAt, setLastDigestAt] = useState<string | null>(null);
  const [savedFeed, setSavedFeed] = useState<
    { id: string | number; type: 'news' | 'forum_thread'; when: string; title?: string }[]
  >([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatar);

  const stats = {
    posts: userPosts.filter((p) => p.type === 'project').length,
    forumPosts: userPosts.filter((p) => p.type === 'forum').length,
    totalLikes: userPosts.reduce((sum, post) => sum + post.likes, 0),
    totalComments: userPosts.reduce((sum, post) => sum + post.comments, 0),
  };

  const getEdgeUrl = () => {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
    return env.VITE_EDGE_URL || '';
  };

  const displayName = preferences.displayNameOverride || user?.name || 'User';
  const bio = preferences.bio || 'Add a short bio so others can learn about you.';
  const interests = preferences.interests;

  useEffect(() => {
    if (!user || !user.id) return;
    fetchUserProfile(user.id).then((rec) => {
      if (rec) {
        updatePreferences({
          displayNameOverride: rec.display_name || undefined,
          bio: rec.bio || undefined,
          location: rec.location || undefined,
          interests: rec.interests || [],
          team: rec.team || undefined,
          showInTeamFinder: rec.show_in_team_finder,
          publicProfile: rec.public_profile,
          emailNotifications: rec.email_notifications,
          emailFrequency:
            (rec as unknown as { email_frequency?: DigestFreq }).email_frequency || 'weekly',
        });
        setDraftDisplayName(rec.display_name || user.name || '');
        setDraftBio(rec.bio || '');
        setDraftLocation(rec.location || '');
        setDraftInterests((rec.interests || []).join(', '));
        const ft = (rec as unknown as Record<string, unknown>)['followed_tags'];
        setDraftFollowedTags(Array.isArray(ft) ? (ft as string[]).join(', ') : '');
        setDraftEmailFrequency(
          (rec as unknown as { email_frequency?: DigestFreq }).email_frequency || 'weekly'
        );
        setLastDigestAt(
          (rec as unknown as { last_digest_at?: string | null }).last_digest_at ?? null
        );
      }
    });
    // Legacy saved_items for 'feed_post' are deprecated. We now show saved news via user_interactions and saved forum threads.
    getSavedItems(user.id).then(async (items) => {
      const threadIds = items.filter((i) => i.item_type === 'forum_thread').map((i) => i.item_id);
      const [savedNews, threads] = await Promise.all([
        getSavedNews(user.id as string),
        fetchForumThreadsByIds(threadIds),
      ]);
      const threadTitleMap = new Map(threads.map((t) => [t.id, t.title]));
      const forumSaved = items
        .filter((i) => i.item_type === 'forum_thread')
        .map((i) => ({
          id: i.item_id as number,
          type: 'forum_thread' as const,
          when: i.created_at,
          title: threadTitleMap.get(i.item_id),
        }));
      const newsSaved = savedNews.map((n) => ({
        id: n.id,
        type: 'news' as const,
        when: n.when,
        title: n.title,
      }));
      setSavedFeed([...newsSaved, ...forumSaved]);
    });
  }, [user, updatePreferences]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-teal-500 to-orange-500 px-4 py-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="size-16 border-[3px] border-white">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-white text-lg text-teal-600">
                {displayName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            {editingProfile && user?.id && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={avatarUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user.id) return;
                    setAvatarError(null);
                    setAvatarUploading(true);
                    try {
                      const updated = await updateAvatar(user.id, file);
                      setAvatarUrl(updated.avatar_url || undefined);
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Upload failed';
                      setAvatarError(msg);
                    } finally {
                      setAvatarUploading(false);
                    }
                  }}
                  className="block w-40 text-xs file:mr-2 file:rounded file:border file:border-gray-200 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium"
                />
                {avatarUploading && <span className="text-[10px] text-teal-100">Uploading…</span>}
                {avatarError && <span className="text-[10px] text-red-200">{avatarError}</span>}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{displayName}</h2>
              {user?.team && (
                <p className="flex items-center text-teal-100">
                  <Users className="mr-1 size-4" />
                  {user.team}
                </p>
              )}
              {(preferences.location || user?.location) && (
                <p className="mt-1 flex items-center text-teal-100">
                  <MapPin className="mr-1 size-4" />
                  {preferences.location || user?.location}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            onClick={() => setEditingProfile((v) => !v)}
          >
            {editingProfile ? <X className="size-4" /> : <Edit3 className="size-4" />}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold">{stats.posts}</div>
            <div className="text-xs text-teal-100">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.forumPosts}</div>
            <div className="text-xs text-teal-100">Forum Posts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.totalLikes}</div>
            <div className="text-xs text-teal-100">Likes</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{badges.length}</div>
            <div className="text-xs text-teal-100">Badges</div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Bio Section */}
            <Card>
              <CardHeader>
                <h3>About</h3>
              </CardHeader>
              <CardContent>
                {!editingProfile && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Bio
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{bio}</p>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-medium">Location</span>
                        <span className="text-muted-foreground">
                          {preferences.location || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 font-medium">Interests</div>
                        {interests.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {interests.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">No interests set</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {editingProfile && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Display Name</label>
                      <Input
                        value={draftDisplayName}
                        onChange={(e) => setDraftDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Location (City, State)</label>
                      <Input
                        value={draftLocation}
                        onChange={(e) => setDraftLocation(e.target.value)}
                        placeholder="Seattle, WA"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Bio</label>
                      <Textarea
                        rows={4}
                        value={draftBio}
                        onChange={(e) => setDraftBio(e.target.value)}
                        placeholder="Tell others about you"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Interests (comma separated)</label>
                      <Input
                        value={draftInterests}
                        onChange={(e) => setDraftInterests(e.target.value)}
                        placeholder="FRC, CAD, AI"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">
                        Followed Tags (personalize your feed)
                      </label>
                      <Input
                        value={draftFollowedTags}
                        onChange={(e) => setDraftFollowedTags(e.target.value)}
                        placeholder="robotics, frc, ai"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        We’ll prioritize content with these tags.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Email Digest Frequency</label>
                      <Select
                        value={draftEmailFrequency}
                        onValueChange={(v: DigestFreq) => setDraftEmailFrequency(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Controls email digests; in-app notifications unaffected.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDraftDisplayName(preferences.displayNameOverride || user?.name || '');
                          setDraftLocation(preferences.location || '');
                          setDraftBio(preferences.bio || '');
                          setDraftInterests(preferences.interests.join(', '));
                          setEditingProfile(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                        onClick={async () => {
                          const interestList = draftInterests
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean);
                          updatePreferences({
                            displayNameOverride: draftDisplayName.trim() || undefined,
                            bio: draftBio.trim() || undefined,
                            location: draftLocation.trim() || undefined,
                            interests: interestList,
                            emailFrequency: draftEmailFrequency,
                          });
                          if (user && user.id) {
                            try {
                              await upsertUserProfile({
                                user_id: user.id,
                                display_name: draftDisplayName.trim() || null,
                                bio: draftBio.trim() || null,
                                location: draftLocation.trim() || null,
                                interests: interestList,
                                followed_tags: draftFollowedTags
                                  .split(',')
                                  .map((t) => t.trim().toLowerCase())
                                  .filter(Boolean),
                                team: user.team || null,
                                show_in_team_finder: preferences.showInTeamFinder,
                                public_profile: preferences.publicProfile,
                                email_notifications: preferences.emailNotifications,
                                email_frequency: draftEmailFrequency,
                                avatar_url: avatarUrl || null,
                              });
                            } catch (e) {
                              // ignore
                            }
                          }
                          setEditingProfile(false);
                        }}
                      >
                        <Save className="mr-1 size-3" />
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Badges */}
            <Card>
              <CardHeader>
                <h3>Achievements</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {badges.map((badge) => (
                    <div key={badge.id} className="rounded-lg bg-gray-50 p-3 text-center">
                      <div className="mb-1 text-2xl">{badge.icon}</div>
                      <div className="text-xs font-medium">{badge.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{badge.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <h3>Recent Activity</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userPosts.slice(0, 3).map((post) => (
                    <div key={post.id} className="flex items-start space-x-3">
                      <div
                        className={`mt-2 size-2 rounded-full ${post.type === 'project' ? 'bg-blue-500' : 'bg-purple-500'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{post.title}</p>
                        <p className="text-xs text-muted-foreground">{post.timestamp}</p>
                        <div className="mt-1 flex items-center space-x-3">
                          <span className="flex items-center text-xs text-muted-foreground">
                            <Heart className="mr-1 size-3" />
                            {post.likes}
                          </span>
                          <span className="flex items-center text-xs text-muted-foreground">
                            <MessageSquare className="mr-1 size-3" />
                            {post.comments}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preferences now merged into About editing form above */}

            {/* Account + Privacy Settings merged */}
            <Card>
              <CardHeader>
                <h3>Account & Privacy</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Show in Team Finder</p>
                    <p className="text-[11px] text-muted-foreground">
                      Allow others to discover you for recruiting
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showInTeamFinder}
                    onCheckedChange={async (v) => {
                      updatePreferences({ showInTeamFinder: v });
                      if (user && user.id) {
                        await upsertUserProfile({ user_id: user.id, show_in_team_finder: v });
                      }
                    }}
                    aria-label="Toggle show in team finder"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-[11px] text-muted-foreground">Receive important updates</p>
                  </div>
                  <Switch
                    checked={preferences.emailNotifications}
                    onCheckedChange={async (v) => {
                      updatePreferences({ emailNotifications: v });
                      if (user && user.id)
                        await upsertUserProfile({ user_id: user.id, email_notifications: v });
                    }}
                    aria-label="Toggle email notifications"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email Digest Frequency</p>
                    <p className="text-[11px] text-muted-foreground">
                      How often to receive digests
                    </p>
                  </div>
                  <div className="w-40">
                    <Select
                      value={preferences.emailFrequency}
                      onValueChange={async (v) => {
                        updatePreferences({ emailFrequency: v as DigestFreq });
                        if (user && user.id)
                          await upsertUserProfile({
                            user_id: user.id,
                            email_frequency: v as DigestFreq,
                          });
                      }}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {lastDigestAt && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Last digest sent</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(lastDigestAt).toLocaleString()}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Public Profile</p>
                    <p className="text-[11px] text-muted-foreground">
                      Profile visible to all users
                    </p>
                  </div>
                  <Switch
                    checked={preferences.publicProfile}
                    onCheckedChange={async (v) => {
                      updatePreferences({ publicProfile: v });
                      if (user && user.id)
                        await upsertUserProfile({ user_id: user.id, public_profile: v });
                    }}
                    aria-label="Toggle public profile visibility"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </Button>
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={async () => {
                      await sendTestDigest(getEdgeUrl(), 7);
                    }}
                  >
                    Send me a test digest
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="mt-4 space-y-4">
            {userPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {post.type === 'project' ? 'Project' : 'Forum Post'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{post.timestamp}</span>
                  </div>
                  <h3 className="mb-1 font-medium">{post.title}</h3>
                  <p className="mb-3 text-sm text-muted-foreground">{post.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center">
                      <Heart className="mr-1 size-3" />
                      {post.likes} likes
                    </span>
                    <span className="flex items-center">
                      <MessageSquare className="mr-1 size-3" />
                      {post.comments} comments
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="saved" className="mt-4 space-y-3">
            {savedFeed.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No saved items yet.
                </CardContent>
              </Card>
            ) : (
              savedFeed.map((s) => (
                <Card key={`${s.type}-${s.id}`}>
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span className="min-w-0 truncate">
                      {s.type === 'news' ? 'News item' : 'Forum thread'} • {s.title || `#${s.id}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.when).toLocaleString()}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-4">
            <TeamFinder user={user} />
          </TabsContent>

          {/* settings tab removed - merged into overview */}
        </Tabs>
      </div>
    </div>
  );
}

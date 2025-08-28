import React, { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useUserPreferences } from './UserPreferencesContext';
import { upsertUserProfile } from '@/services/userProfiles';

interface OnboardingInterestsProps {
  userId: string;
  displayName?: string;
  initialInterests?: string[];
  onComplete: (interests: string[]) => void;
}

// Curated starter interests. Short and recognizable for FIRST + robotics topics.
const SUGGESTED: string[] = [
  'FRC',
  'FTC',
  'FLL',
  'CAD',
  'Programming',
  'Electrical',
  'Mechanisms',
  'Strategy',
  'Autonomous',
  'Vision',
  'AI',
  'Machine Learning',
  'Path Planning',
  'Sensors',
  'Control Systems',
  'Swerve',
];

export function OnboardingInterests({
  userId,
  displayName,
  initialInterests = [],
  onComplete,
}: OnboardingInterestsProps) {
  const { updatePreferences } = useUserPreferences();
  const [selected, setSelected] = useState<string[]>(() => Array.from(new Set(initialInterests)));
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const allSuggestions = useMemo(() => {
    // Keep selected suggestions first, then remaining suggestions
    const chosen = SUGGESTED.filter((s) => selected.includes(s));
    const remaining = SUGGESTED.filter((s) => !selected.includes(s));
    return [...chosen, ...remaining];
  }, [selected]);

  const toggle = (tag: string) => {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomFromInput = () => {
    const items = custom
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!items.length) return;
    setSelected((prev) => Array.from(new Set([...prev, ...items])));
    setCustom('');
  };

  const save = async (skip = false) => {
    try {
      setSaving(true);
      const interests = skip ? [] : selected;
      // Persist to profile
      await upsertUserProfile({ user_id: userId, interests });
      // Update local preferences to personalize feed immediately
      updatePreferences({ interests });
      onComplete(interests);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <h2 className="text-xl font-semibold">Welcome{displayName ? `, ${displayName}` : ''}!</h2>
          <p className="text-sm text-muted-foreground">
            Pick a few interests to personalize your feed. You can change these anytime in your
            profile.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Suggested Topics
            </div>
            <div className="flex flex-wrap gap-2">
              {allSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selected.includes(tag)
                      ? 'border-teal-600 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add your own
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomFromInput();
                  }
                }}
                placeholder="e.g., drivetrain, outreach, python"
              />
              <Button variant="outline" onClick={addCustomFromInput} disabled={!custom.trim()}>
                Add
              </Button>
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => save(true)} disabled={saving}>
              Skip for now
            </Button>
            <Button onClick={() => save(false)} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OnboardingInterests;

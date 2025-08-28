import React, { useState } from 'react';
import { X, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

const suggestionTags = [
  'help',
  'programming',
  'mechanical',
  'electronics',
  'strategy',
  'controls',
  'vision',
  'cad',
];

interface NewThreadModalProps {
  // user intentionally omitted for now; add when backend integration done
  onClose: () => void;
  onCreate?: (thread: { title: string; body: string; tags: string[] }) => void;
}

export function NewThreadModal({ onClose, onCreate }: NewThreadModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addTag = (t: string) => {
    const tag = t.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    setTags([...tags, tag]);
  };

  const removeTag = (t: string) => setTags(tags.filter((tag) => tag !== t));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    // Mock create – replace with API call later
    const newThread = { title: title.trim(), body: body.trim(), tags };
    console.log('[Forums] Creating thread', newThread);
    onCreate?.(newThread);
    setTimeout(() => {
      // simulate latency
      setSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <h3 className="text-lg font-semibold">Ask a Question</h3>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            <X className="size-4" />
          </Button>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="thread-title">Title *</Label>
              <Input
                id="thread-title"
                placeholder="Clear, specific question title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={140}
              />
              <p className="text-right text-[10px] text-muted-foreground">{title.length}/140</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thread-body">Details *</Label>
              <Textarea
                id="thread-body"
                placeholder="Provide context, what you tried, errors, logs, robot behavior, etc."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Include enough info for others to help efficiently.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Tags</Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100 hover:text-red-700"
                      onClick={() => removeTag(t)}
                    >
                      {t}
                      <X className="ml-1 size-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                      setTagInput('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    addTag(tagInput);
                    setTagInput('');
                  }}
                  disabled={!tagInput.trim()}
                >
                  <Tag className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestionTags.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className={`rounded border px-2 py-1 text-xs transition-colors ${
                      tags.includes(s)
                        ? 'border-teal-300 bg-teal-100 text-teal-800'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <div className="flex gap-3 px-6 pb-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={submitting || !title.trim() || !body.trim()}
            >
              {submitting ? 'Posting…' : 'Post Question'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

'use client';

import { usePbnTranslations } from '@/i18n/useTranslations';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchSelect } from '@/components/common/SearchSelect';
import UserAvatar from '@/components/user/UserAvatar';
import { forumIngestApi } from '@/lib/api';
import { toast } from 'sonner';
import { Copy, Loader2, Plus, ShieldOff, X } from 'lucide-react';

export function ExternalIntegrationsSettings() {
  const pbnT = usePbnTranslations();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('SEO-OPS');
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [createdToken, setCreatedToken] = useState(null);
  const [apiHints, setApiHints] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await forumIngestApi.list();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      toast.error(error.message || pbnT('ingestLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [pbnT]);

  useEffect(() => {
    load();
  }, [load]);

  const searchAuthors = useCallback(async (query) => {
    const data = await forumIngestApi.searchAuthors(query, 10);
    return Array.isArray(data?.items) ? data.items : [];
  }, []);

  const transformAuthor = (user) => ({
    id: user.id,
    label: user.name || user.username,
    description: user.username,
    avatar: user.avatar,
    email: user.email,
    username: user.username,
  });

  const renderAuthorItem = (user, transformed, onSelect, isHighlighted) => (
    <button
      key={transformed.id}
      type="button"
      className={`w-full flex items-center gap-3 p-3 text-left cursor-pointer transition-colors ${
        isHighlighted ? 'bg-accent' : 'hover:bg-muted'
      }`}
      onClick={onSelect}
    >
      <UserAvatar url={transformed.avatar} name={transformed.label} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{transformed.label}</div>
        <div className="text-xs text-muted-foreground truncate">@{transformed.username}</div>
        {transformed.email ? (
          <div className="text-xs text-muted-foreground truncate">{transformed.email}</div>
        ) : null}
      </div>
    </button>
  );

  const renderSelectedAuthor = (user, transformed, onClear) => (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-md bg-muted/40">
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar url={transformed.avatar} name={transformed.label} size="sm" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{transformed.label}</div>
          <div className="text-xs text-muted-foreground truncate">
            @{transformed.username}
            {transformed.email ? ` · ${transformed.email}` : ''}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onClear}
        disabled={saving}
        aria-label={pbnT('ingestAuthorClear')}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  const canCreate =
    Boolean(name.trim()) &&
    Number.isInteger(Number(selectedAuthor?.id)) &&
    Number(selectedAuthor.id) > 0 &&
    !saving;

  const handleCreate = async () => {
    const authorId = Number(selectedAuthor?.id);
    if (!name.trim() || !Number.isInteger(authorId) || authorId <= 0) {
      toast.error(pbnT('ingestCreateValidation'));
      return;
    }
    try {
      setSaving(true);
      const result = await forumIngestApi.create({
        name: name.trim(),
        authorUserId: authorId,
      });
      setCreatedToken(result.token);
      setApiHints(result.api);
      setSelectedAuthor(null);
      toast.success(pbnT('ingestCreateSuccess'));
      await load();
    } catch (error) {
      toast.error(error.message || pbnT('ingestCreateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(pbnT('ingestRevokeConfirm'))) return;
    try {
      setSaving(true);
      await forumIngestApi.revoke(id);
      toast.success(pbnT('ingestRevokeSuccess'));
      await load();
    } catch (error) {
      toast.error(error.message || pbnT('ingestRevokeFailed'));
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(pbnT('ingestCopied'));
    } catch {
      toast.error(pbnT('ingestCopyFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{pbnT('ingestTitle')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{pbnT('ingestIntro')}</p>
      </div>

      <Alert>
        <AlertDescription className="text-sm space-y-1">
          <p>{pbnT('ingestSecurityNote')}</p>
          <p>{pbnT('ingestAuthorNote')}</p>
        </AlertDescription>
      </Alert>

      <div className="content-card p-4 space-y-4">
        <h3 className="font-medium">{pbnT('ingestCreateHeading')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ingest-name">{pbnT('ingestNameLabel')}</Label>
            <Input
              id="ingest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <SearchSelect
            value={selectedAuthor}
            onChange={setSelectedAuthor}
            searchFn={searchAuthors}
            transformData={transformAuthor}
            renderItem={renderAuthorItem}
            renderSelected={renderSelectedAuthor}
            label={pbnT('ingestAuthorLabel')}
            placeholder={pbnT('ingestAuthorPlaceholder')}
            autoSearch
            debounceMs={300}
            minQueryLength={2}
            openOnEmpty
            emptyText={pbnT('ingestAuthorNoResults')}
            minCharsText={pbnT('ingestAuthorMinChars')}
            errorText={pbnT('ingestAuthorSearchFailed')}
            clearText={pbnT('ingestAuthorClear')}
            disabled={saving}
          />
        </div>
        <Button onClick={handleCreate} disabled={!canCreate}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-2">{pbnT('ingestCreateButton')}</span>
        </Button>
      </div>

      {createdToken && (
        <Alert>
          <AlertDescription className="space-y-3">
            <p className="font-medium">{pbnT('ingestTokenOnce')}</p>
            <div className="flex gap-2 items-start">
              <code className="text-xs break-all bg-muted p-2 rounded flex-1">{createdToken}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => copyText(createdToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {apiHints && (
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  <strong>{apiHints.endpoint}</strong>
                </p>
                <p>{apiHints.authorization}</p>
                <p>{pbnT('ingestApiBodyHint')}</p>
                <ul className="list-disc pl-4">
                  {(apiHints.notes || []).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="content-card p-4 space-y-3">
        <h3 className="font-medium">{pbnT('ingestListHeading')}</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {pbnT('m71')}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pbnT('ingestEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-3">{pbnT('ingestColName')}</th>
                  <th className="py-2 pr-3">{pbnT('ingestColKey')}</th>
                  <th className="py-2 pr-3">{pbnT('ingestColAuthor')}</th>
                  <th className="py-2 pr-3">{pbnT('ingestColStatus')}</th>
                  <th className="py-2">{pbnT('ingestColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{item.keyId}</td>
                    <td className="py-2 pr-3">
                      {item.authorUsername || item.authorUserId}
                      {item.authorName ? ` (${item.authorName})` : ''}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          item.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'
                        }
                      >
                        {item.status === 'active'
                          ? pbnT('ingestStatusActive')
                          : pbnT('ingestStatusRevoked')}
                      </span>
                    </td>
                    <td className="py-2">
                      {item.status === 'active' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => handleRevoke(item.id)}
                        >
                          <ShieldOff className="h-4 w-4 mr-1" />
                          {pbnT('ingestRevokeButton')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

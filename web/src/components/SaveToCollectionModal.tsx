import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@chakra-ui/react';
import { Bookmark, X, FolderPlus, Check } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import {
  getUserCollections,
  createCollection,
  addItemToCollection,
  removeItemFromCollection,
  getCollectionsForItem,
  type CollectionWithCount,
} from '@/lib/collections';

interface SaveToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
}

export default function SaveToCollectionModal({
  isOpen,
  onClose,
  itemId,
  itemTitle,
}: SaveToCollectionModalProps) {
  const { userId } = useUser();
  const [colList, setColList] = useState<CollectionWithCount[]>([]);
  const [savedColIds, setSavedColIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cols, savedIds] = await Promise.all([
        getUserCollections(userId),
        getCollectionsForItem(itemId, userId),
      ]);
      setColList(cols);
      setSavedColIds(new Set(savedIds));
    } catch {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [userId, itemId]);

  useEffect(() => {
    if (isOpen) {
      void load();
      setShowNewForm(false);
      setNewName('');
      setError(null);
    }
  }, [isOpen, load]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  async function toggleCollection(colId: number, isSaved: boolean) {
    if (saving !== null) return;
    setSaving(colId);
    try {
      if (isSaved) {
        await removeItemFromCollection(colId, itemId);
        setSavedColIds((prev) => { const n = new Set(prev); n.delete(colId); return n; });
        setColList((prev) => prev.map((c) => c.id === colId ? { ...c, itemCount: c.itemCount - 1 } : c));
      } else {
        await addItemToCollection(colId, itemId);
        setSavedColIds((prev) => new Set([...prev, colId]));
        setColList((prev) => prev.map((c) => c.id === colId ? { ...c, itemCount: c.itemCount + 1 } : c));
      }
    } catch {
      setError('Failed to update collection');
    } finally {
      setSaving(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const col = await createCollection(userId, newName.trim());
      await addItemToCollection(col.id, itemId);
      setSavedColIds((prev) => new Set([...prev, col.id]));
      setColList((prev) => [{ ...col, itemCount: 1 }, ...prev]);
      setShowNewForm(false);
      setNewName('');
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  }

  if (!isOpen) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          background: '#111827',
          border: '1px solid #374151',
          borderRadius: '16px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
            borderBottom: '1px solid #1f2937',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bookmark size={16} color="#60a5fa" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
              Save to Collection
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Item title ── */}
        <div
          style={{
            padding: '10px 16px 10px',
            borderBottom: '1px solid #1f2937',
            background: '#0f172a',
          }}
        >
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Saving item
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#d1d5db',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {itemTitle}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ fontSize: 12, color: '#f87171' }}>{error}</span>
          </div>
        )}

        {/* ── Collections list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Spinner size="sm" color="blue.400" />
            </div>
          ) : colList.length === 0 && !showNewForm ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#4b5563' }}>
              <Bookmark size={28} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13 }}>No collections yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Create one below</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {colList.map((col) => {
                const isSaved = savedColIds.has(col.id);
                const isSaving = saving === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleCollection(col.id, isSaved)}
                    disabled={isSaving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 10,
                      border: `1px solid ${isSaved ? '#1d4ed8' : '#374151'}`,
                      background: isSaved ? 'rgba(29,78,216,0.15)' : 'rgba(31,41,55,0.6)',
                      cursor: isSaving ? 'default' : 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {/* Icon box */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: isSaved ? 'rgba(37,99,235,0.3)' : '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSaving ? (
                        <Spinner size="xs" color="blue.400" />
                      ) : isSaved ? (
                        <Check size={14} color="#60a5fa" />
                      ) : (
                        <Bookmark size={13} color="#9ca3af" />
                      )}
                    </div>

                    {/* Name + desc */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSaved ? '#93c5fd' : '#f3f4f6',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.name}
                      </div>
                      {col.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#6b7280',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col.description}
                        </div>
                      )}
                    </div>

                    {/* Count pill */}
                    <div
                      style={{
                        fontSize: 11,
                        color: isSaved ? '#60a5fa' : '#6b7280',
                        background: isSaved ? 'rgba(37,99,235,0.2)' : '#1f2937',
                        border: `1px solid ${isSaved ? '#1d4ed8' : '#374151'}`,
                        borderRadius: 20,
                        padding: '1px 8px',
                        flexShrink: 0,
                        minWidth: 24,
                        textAlign: 'center',
                        fontWeight: 500,
                      }}
                    >
                      {col.itemCount}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* New collection inline form */}
          {showNewForm && (
            <form
              onSubmit={handleCreate}
              style={{
                marginTop: colList.length > 0 ? 8 : 0,
                padding: '10px',
                background: 'rgba(37,99,235,0.08)',
                border: '1px solid rgba(37,99,235,0.4)',
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New collection
              </div>
              <input
                autoFocus
                required
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid #374151',
                  background: '#0f172a',
                  color: 'white',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#374151'; }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowNewForm(false); setNewName(''); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 7,
                    border: '1px solid #374151',
                    background: 'transparent',
                    color: '#9ca3af',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || creating}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 7,
                    border: 'none',
                    background: newName.trim() ? '#2563eb' : '#1e3a8a',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: newName.trim() ? 'pointer' : 'default',
                    opacity: creating ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {creating ? <Spinner size="xs" /> : <><Check size={12} />&nbsp;Create &amp; Save</>}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderTop: '1px solid #1f2937',
          }}
        >
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(37,99,235,0.35)',
                background: 'transparent',
                color: '#60a5fa',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <FolderPlus size={13} />
              New Collection
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { Bookmark, BookmarkCheck, Trash2, StickyNote } from 'lucide-react';

interface SavedTender {
  id: string;
  tender_id: string;
  notes: string | null;
  created_at: string;
  tender?: {
    title: string;
    source: string;
    status: string;
    closing_date: string | null;
    budget?: { amount: number; currency: string };
  };
}

export function useFavorites() {
  const qc = useQueryClient();

  const { data: favorites = [] } = useQuery<SavedTender[]>({
    queryKey: ['favorites'],
    queryFn: () => apiClient.get('/users/saved-tenders'),
  });

  const save = useMutation({
    mutationFn: (tenderId: string) =>
      apiClient.post('/users/saved-tenders', { tenderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const remove = useMutation({
    mutationFn: (tenderId: string) =>
      apiClient.delete(`/users/saved-tenders/${tenderId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const isSaved = (tenderId: string) =>
    favorites.some((f) => f.tender_id === tenderId);

  return { favorites, save, remove, isSaved };
}

interface FavoriteButtonProps {
  tenderId: string;
}

export function FavoriteButton({ tenderId }: FavoriteButtonProps) {
  const { save, remove, isSaved } = useFavorites();
  const saved = isSaved(tenderId);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) {
      remove.mutate(tenderId);
    } else {
      save.mutate(tenderId);
    }
  };

  return (
    <button
      onClick={toggle}
      title={saved ? 'Quitar de favoritos' : 'Guardar licitación'}
      className={`p-1.5 rounded-lg transition-colors ${
        saved
          ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
          : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
      }`}
    >
      {saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
    </button>
  );
}

export function FavoritesList() {
  const qc = useQueryClient();
  const { favorites, remove } = useFavorites();
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const saveNote = async (tenderId: string) => {
    await apiClient.patch(`/users/saved-tenders/${tenderId}`, { notes: noteText });
    qc.invalidateQueries({ queryKey: ['favorites'] });
    setEditingNote(null);
  };

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tienes licitapp guardadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {favorites.map((fav) => (
        <div key={fav.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {fav.tender?.title ?? fav.tender_id}
              </p>
              {fav.notes && (
                <p className="text-xs text-gray-500 mt-1 italic">"{fav.notes}"</p>
              )}
              {editingNote === fav.tender_id && (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Agregar nota..."
                    className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button onClick={() => saveNote(fav.tender_id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded-lg">Guardar</button>
                  <button onClick={() => setEditingNote(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setEditingNote(fav.tender_id); setNoteText(fav.notes ?? ''); }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
              >
                <StickyNote className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove.mutate(fav.tender_id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


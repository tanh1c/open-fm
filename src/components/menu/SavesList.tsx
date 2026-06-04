import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/helpers";
import { Play, Clock, CalendarDays, Trash2, X, Loader2, HardDrive } from "lucide-react";

function formatSaveSize(bytes?: number | null): string | null {
  if (bytes === undefined || bytes === null) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

interface SaveEntry {
  id: string;
  name: string;
  manager_name: string;
  db_filename: string;
  checksum: string;
  created_at: string;
  last_played_at: string;
  game_date?: string | null;
  size_bytes?: number | null;
}

interface SavesListProps {
  saves: SaveEntry[];
  isLoading: boolean;
  loadingSaveId?: string | null;
  confirmDeleteId: string | null;
  onLoad: (saveId: string) => void;
  onDelete: (saveId: string) => void;
  onConfirmDelete: (saveId: string | null) => void;
  onClose: () => void;
}

export default function SavesList({ saves, isLoading, loadingSaveId, confirmDeleteId, onLoad, onDelete, onConfirmDelete, onClose }: SavesListProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white transition-colors">
          {t('menu.loadGame')}
        </h2>
        <button 
          type="button" 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-500 dark:text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /><span className="text-sm font-heading uppercase tracking-wider">{t('menu.loadingSaves')}</span></div>
        ) : saves.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-8">{t('menu.noSaves')}</div>
        ) : (
          saves.map(save => {
            const saveSize = formatSaveSize(save.size_bytes);

            return (
            <div key={save.id} className="group relative flex flex-col gap-2 w-full p-4 bg-white dark:bg-surface-700 hover:bg-primary-50 dark:hover:bg-surface-600 text-left rounded-xl transition-all duration-200 border border-gray-200 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 shadow-sm">
              {confirmDeleteId === save.id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: t('menu.deleteConfirm', { name: save.name }) }} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDelete(save.id)}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-heading font-bold uppercase tracking-wider rounded-lg transition-colors"
                    >
                      {t('menu.delete')}
                    </button>
                    <button
                      onClick={() => onConfirmDelete(null)}
                      className="flex-1 py-2 bg-gray-200 dark:bg-surface-600 hover:bg-gray-300 dark:hover:bg-surface-600 text-gray-700 dark:text-gray-300 text-sm font-heading font-bold uppercase tracking-wider rounded-lg transition-colors"
                    >
                      {t('menu.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => onLoad(save.id)}
                    className="flex flex-col gap-2 flex-1 text-left min-w-0"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-heading font-bold text-gray-900 dark:text-white text-lg uppercase tracking-wide truncate">{save.name}</span>
                      {loadingSaveId === save.id ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" /> : <Play className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />}
                    </div>
                    <div className="flex justify-between items-center w-full text-sm text-gray-500 dark:text-gray-400">
                      <span>{t('menu.manager', { name: save.manager_name })}</span>
                      <div className="flex items-center gap-3">
                        {save.game_date ? (
                          <div className="flex items-center gap-1" title={t('menu.inGameDate', { defaultValue: 'In-game date' })}>
                            <CalendarDays className="w-3 h-3" />
                            <span>{formatDate(save.game_date, i18n.language)}</span>
                          </div>
                        ) : null}
                        {saveSize ? (
                          <div className="flex items-center gap-1" title={t('menu.saveSize', { defaultValue: 'Save size' })}>
                            <HardDrive className="w-3 h-3" />
                            <span>{saveSize}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-1" title={t('menu.lastPlayed', { defaultValue: 'Last played' })}>
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(save.last_played_at, i18n.language)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onConfirmDelete(save.id); }}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title={t('menu.deleteSave')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

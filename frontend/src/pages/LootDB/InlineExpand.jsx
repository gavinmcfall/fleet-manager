import { X, Bookmark, BookmarkPlus, Plus, MapPin } from 'lucide-react'
import { rarityStyle, CATEGORY_BADGE_STYLES, CATEGORY_LABELS, effectiveCategory, humanizeRawDisplayName } from '../../lib/lootDisplay'
import SourceIcons from './SourceIcons'

export default function InlineExpand({ item, collectionQty, onSetCollectionQty, wishlisted, onToggleWishlist, isAuthed, onClose, onOpenDetail }) {
  const rs = item.rarity ? rarityStyle(item.rarity) : null
  const eCat = effectiveCategory(item)
  const catStyle = CATEGORY_BADGE_STYLES[eCat] || CATEGORY_BADGE_STYLES.unknown
  const catLabel = CATEGORY_LABELS[eCat] || eCat

  return (
    <div className="col-span-full panel p-4 space-y-3 animate-fade-in border-sc-accent/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-display uppercase tracking-wide px-1.5 py-0.5 rounded ${catStyle}`}>
              {catLabel}
            </span>
            {item.rarity && rs && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${rs.badge}`}>
                {item.rarity}
              </span>
            )}
            <SourceIcons item={item} />
          </div>
          <h3 className="text-sm font-semibold text-white mt-1.5">{humanizeRawDisplayName(item.name)}</h3>
          {item.manufacturer_name && (
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">{item.manufacturer_name}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isAuthed && (
          <>
            <button
              onClick={() => onToggleWishlist(item.uuid, wishlisted)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-display uppercase tracking-wide border transition-all ${
                wishlisted
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'border-sc-border text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {wishlisted ? <Bookmark className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
            <button
              onClick={() => onSetCollectionQty(item.uuid, collectionQty > 0 ? 0 : 1)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-display uppercase tracking-wide border transition-all ${
                collectionQty > 0
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'border-sc-border text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              <Plus className="w-3 h-3" />
              {collectionQty > 0 ? `Collected (${collectionQty})` : 'Collect'}
            </button>
          </>
        )}
        <button
          onClick={() => onOpenDetail(item.uuid)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-display uppercase tracking-wide border border-sc-border text-gray-400 hover:text-sc-accent hover:border-sc-accent/40 transition-all ml-auto"
        >
          <MapPin className="w-3 h-3" />
          Where to find
        </button>
      </div>
    </div>
  )
}

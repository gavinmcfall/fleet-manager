import React, { useState, useMemo } from 'react'
import { X, Trash2, RefreshCw, ShoppingCart, MapPin } from 'lucide-react'
import { removeLoadoutCartItem, emptyLoadoutCart, optimizeLoadoutCart, updateLoadoutCartItem } from '../../hooks/useAPI'

/**
 * Sliding cart panel showing all cart items grouped by shop for minimum-stops shopping.
 */
export default function CartPanel({ cartData, cartLoading, refetchCart, onClose }) {
  const [optimizing, setOptimizing] = useState(false)

  const items = cartData?.items || []
  const totalPrice = items.reduce((sum, item) => sum + (Number(item.buy_price) || 0) * (item.quantity || 1), 0)

  // Group items by shop for the "shopping route" view
  const byShop = useMemo(() => {
    const groups = {}
    for (const item of items) {
      const shopKey = item.shop_name || 'No shop (loot only)'
      if (!groups[shopKey]) {
        groups[shopKey] = {
          shop_name: item.shop_name,
          location: item.location_label,
          items: [],
          subtotal: 0,
        }
      }
      groups[shopKey].items.push(item)
      groups[shopKey].subtotal += (Number(item.buy_price) || 0) * (item.quantity || 1)
    }
    return Object.values(groups)
  }, [items])

  const handleOptimize = async () => {
    setOptimizing(true)
    try {
      await optimizeLoadoutCart()
      refetchCart()
    } finally {
      setOptimizing(false)
    }
  }

  const handleRemoveItem = async (cartId) => {
    await removeLoadoutCartItem(cartId)
    refetchCart()
  }

  const handleEmptyCart = async () => {
    await emptyLoadoutCart()
    refetchCart()
  }

  const handleQuantityChange = async (cartId, newQty) => {
    if (newQty < 1) {
      await handleRemoveItem(cartId)
      return
    }
    await updateLoadoutCartItem(cartId, { quantity: newQty })
    refetchCart()
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-gray-950 border-l border-white/[0.08] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Shopping Cart</h3>
          <span className="text-xs text-gray-500">({items.length} items)</span>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-300 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-white/[0.06]">
        <button
          onClick={handleOptimize}
          disabled={optimizing || items.length === 0}
          className="px-3 py-1 text-xs bg-sc-accent/20 hover:bg-sc-accent/30 text-sc-accent border border-sc-accent/30 disabled:bg-zinc-700 disabled:text-gray-500 text-white rounded transition-colors flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${optimizing ? 'animate-spin' : ''}`} />
          Optimize Shops
        </button>
        <button
          onClick={handleEmptyCart}
          disabled={items.length === 0}
          className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 disabled:bg-zinc-800 disabled:text-gray-600 text-red-300 rounded transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Empty Cart
        </button>
      </div>

      {/* Cart items grouped by shop */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            Cart is empty. Click the cart icon on a component to add it.
          </div>
        )}

        {byShop.map((group, gi) => (
          <div key={gi} className="border-b border-white/[0.04]">
            {/* Shop header */}
            <div className="px-5 py-2 bg-white/[0.03] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-500" />
                <span className="text-xs font-medium text-gray-300">{group.shop_name || 'Loot Only'}</span>
                {group.location && <span className="text-[11px] text-gray-500">{group.location}</span>}
              </div>
              {group.subtotal > 0 && (
                <span className="text-xs text-amber-300">{group.subtotal.toLocaleString()} aUEC</span>
              )}
            </div>

            {/* Items */}
            {group.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-2 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 truncate">{item.component_name}</div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    {item.manufacturer_name && <span>{item.manufacturer_name}</span>}
                    <span>S{item.size}</span>
                    {item.fleet_ship_name && (
                      <span className="text-sc-accent/70">for {item.fleet_custom_name || item.fleet_ship_name}</span>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="w-5 h-5 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 rounded flex items-center justify-center"
                  >−</button>
                  <span className="w-6 text-center text-xs text-gray-300">{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    className="w-5 h-5 text-xs bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 rounded flex items-center justify-center"
                  >+</button>
                </div>

                {/* Price */}
                <div className="w-20 text-right">
                  {item.buy_price ? (
                    <span className="text-xs text-amber-300">{(Number(item.buy_price) * item.quantity).toLocaleString()}</span>
                  ) : (
                    <span className="text-[11px] text-orange-400">Loot</span>
                  )}
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer with total */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-lg font-semibold text-amber-300">{totalPrice.toLocaleString()} aUEC</span>
        </div>
      )}
    </div>
  )
}

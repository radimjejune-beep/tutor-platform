// Website checkout only; a missing payment setup never falls back to Telegram.
export function buyLink(p, shop) {
  if (p.free && p.demo) return { href: p.demo, label: 'Открыть бесплатно' };
  if (p.status === 'soon') return shop.bot || shop.channel ? { href: shop.channel || `https://t.me/${shop.bot}`, label: 'Узнать о выходе', quiet: true } : null;
  const label = p.status === 'preorder' ? 'Предзаказ' : 'Купить';
  if (shop.pay) return { href: `${shop.shop_url}/?buy=${encodeURIComponent(p.sku)}`, label };
  return null;
}


// Bullseye Arms price list. Weapon prices are tiered; ammo is sold in packs; grenades can be bought again and again.
export const SHOP_NAME = 'Bullseye Arms';

// kind 'weapon': buying gives the weapon with its starting ammo (see WEAPON_DEFS). `pack` = extra rounds on a repeat purchase.
export const WEAPONS = [
  { id: 'smg', price: 900, blurb: 'Fast and light. 30 rounds, full auto.' },
  { id: 'shotgun', price: 1500, blurb: '8 pellets, brutal at close range.' },
  { id: 'rifle', price: 2800, blurb: 'Accurate full-auto. 30 rounds.' },
  { id: 'sniper', price: 4500, blurb: 'One shot, one kill. RMB = scope.' },
  { id: 'grenade', price: 600, pack: 5, blurb: 'Pack of 5. Throw, bounce, boom.' },
];

// Ammo packs for owned weapons: rounds per purchase and price.
export const AMMO = [
  { id: 'pistol', rounds: 24, price: 80 },
  { id: 'smg', rounds: 60, price: 180 },
  { id: 'shotgun', rounds: 12, price: 150 },
  { id: 'rifle', rounds: 60, price: 300 },
  { id: 'sniper', rounds: 10, price: 350 },
];

export const ARMOR = { price: 450, amount: 100 };

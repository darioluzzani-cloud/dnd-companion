'use client';
import { CampaignState } from '@/lib/types';

// ─── Tipi e utility condivise tra le tab ─────────────────────
export type U = (p: Partial<CampaignState> | ((s:CampaignState)=>Partial<CampaignState>)) => void;

export const ITEM_TYPES = ['equipaggiamento','arma','armatura','magico','unico','consumabile','tesoro','quest','alchemico','altro'];

export function moveInArray<T>(arr: T[], idx: number, dir: -1|1): T[] {
  const next = idx + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[next]] = [copy[next], copy[idx]];
  return copy;
}

// Pulsanti riordino
export function ReorderBtns({ onUp, onDown }: { onUp:()=>void; onDown:()=>void }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:1,flexShrink:0,marginLeft:4}}>
      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10,lineHeight:1}} onClick={e=>{e.stopPropagation();onUp();}}>▲</button>
      <button className="btn btn-ghost" style={{padding:'1px 5px',fontSize:10,lineHeight:1}} onClick={e=>{e.stopPropagation();onDown();}}>▼</button>
    </div>
  );
}

// ── Calcolo automatico CA ──
export function computeAC(p: any): number {
  const abs = (p as any).abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const dexMod = Math.floor(((abs.dex || 10) - 10) / 2);
  const conMod = Math.floor(((abs.con || 10) - 10) / 2);
  const wisMod = Math.floor(((abs.wis || 10) - 10) / 2);

  const inv = (p.inventory || []) as any[];
  const equippedArmor = inv.filter((i: any) => i.type === 'armatura' && i.equipped);
  const bodyArmor = equippedArmor.find((i: any) => i.armorType && i.armorType !== 'scudo');
  const shield = equippedArmor.find((i: any) => i.armorType === 'scudo');

  let ac: number;
  if (!bodyArmor || !bodyArmor.armorCA) {
    const cls = (p.cls || '').toLowerCase();
    if (cls.includes('barbar')) {
      ac = 10 + dexMod + conMod;
    } else if (cls.includes('monac')) {
      ac = 10 + dexMod + wisMod;
    } else {
      ac = 10 + dexMod;
    }
  } else {
    const base = bodyArmor.armorCA;
    const at = bodyArmor.armorType;
    if (at === 'leggera') ac = base + dexMod;
    else if (at === 'media') ac = base + Math.min(dexMod, 2);
    else ac = base; // pesante
  }
  if (shield) ac += (shield.armorCA || 2);
  return ac;
}

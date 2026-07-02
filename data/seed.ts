import { CampaignState } from '@/lib/types';
import { DEFAULT_CALENDAR } from '@/lib/dnd/calendar';

export const SEED: CampaignState = {
  tab: 'quests',
  campaign: 'Marca di Velmora',
  dmMode: false,
  editMode: false,
  activeScenario: 'sc2',
  scenarios: [
    {id:'sc1', name:'Il risveglio nella palude', status:'concluso', quests:[
      {id:'sc1q1',type:'main',title:'Fuggire dalle prigioni dei coboldi',desc:'Catturati nel sonno e rinchiusi nelle gabbie sospese.',done:true,revealed:true},
      {id:'sc1q2',type:'side',title:'Liberare i prigionieri del villaggio',desc:'Sette contadini tenuti per il riscatto.',done:true,revealed:true},
      {id:'sc1q3',type:'main',title:'Scoprire chi vi ha drogati alla locanda',desc:'Il vino era stato manomesso. Indizio mai chiarito del tutto.',done:false,revealed:true},
    ]},
    {id:'sc2', name:"L'ombra su Fenwick", status:'corso', quests:[
      {id:'q1',type:'main',title:"Recuperare l'Amuleto di Vethkar",desc:'Sepolto nella cripta sotto la cappella in rovina, a est del borgo.',done:false,revealed:true},
      {id:'q2',type:'side',title:'Ritrovare il gatto di Madame Elara',desc:'Avvistato vicino al vecchio mulino sul fiume.',done:true,revealed:true},
      {id:'q3',type:'side',title:'Consegnare la lettera sigillata a Brennan',desc:'Brennan presidia la torre di guardia a nord.',done:false,revealed:true},
      {id:'q4',type:'main',title:'Scoprire chi ha avvelenato il borgomastro',desc:'I sospetti: il fabbro, la locandiera e il giovane chierico.',done:false,revealed:false},
      {id:'q5',type:'main',title:'La vera natura di Madame Elara',desc:'È legata a Vethkar da un antico patto. Rivelare solo dopo la cripta.',done:false,revealed:false},
    ]},
    {id:'sc3', name:'La marcia su Vethkar', status:'futuro', quests:[
      {id:'sc3q1',type:'main',title:"Trovare l'ingresso della cripta finale",desc:'Si apre solo durante la luna nuova.',done:false,revealed:false},
      {id:'sc3q2',type:'main',title:'Distruggere il filatterio del lich',desc:'Finché esiste, Vethkar non può morire davvero.',done:false,revealed:false},
    ]},
  ],
  characters: [
    {id:'c5',name:'Corvan Brugh',role:'Umano - Capo bandito',location:'Marca di Velmora',relation:'neutral',note:"Corvan Brugh, ex capobanda, un uomo di portamento marcatamente militare, riconoscibile dalla cicatrice che gli attraversa il sopracciglio; abile calcolatore. Ad oggi non si sa dove sia."},
    {id:'c6',name:'Reva Maren',role:'Mercante',location:'Olmobianco | Marca di Velmora',relation:'ally',note:"Reva Maren è una mercante sui quarant'anni della Via dei Mercanti di Mezzo, robusta e diretta, con i capelli castani raccolti malamente: pratica fino all'osso, un po' spigolosa ma non scortese. Torna al villaggio ogni tre o quattro settimane con notizie e merci."},
  ],
  activePlayer: 'p1',
  players: [
    {id:'p1',name:'Aconito',short:'Aconito',cls:'Ladro',color:'#a489dd',xp:870,caster:'third',slotsUsed:{'1':1},
      spells:[
        {id:'p1s1',name:'Mano Magica',level:0,school:'Trucco',desc:'Mano spettrale che manipola oggetti fino a 9 m.',prepared:true,expanded:false},
        {id:'p1s2',name:'Charme su Persone',level:1,school:'Ammaliamento',desc:'TS Saggezza o il bersaglio ti considera un amico fidato. Dura 1 ora.',prepared:true,expanded:false},
        {id:'p1s3',name:'Camuffare Sé Stesso',level:1,school:'Illusione',desc:'Cambi aspetto per 1 ora. Solo illusione visiva, non al tatto.',prepared:false,expanded:false},
      ],
      inventory:[
        {id:'p1i1',name:'Arnesi da scasso',qty:1,type:'equipaggiamento'},
        {id:'p1i2',name:'Pugnale',qty:2,type:'arma'},
        {id:'p1i3',name:'Mantello elfico',qty:1,type:'magico'},
        {id:'p1i4',name:'Pozione di cura',qty:1,type:'consumabile'},
        {id:'p1i5',name:"Monete d'oro",qty:85,type:'tesoro'},
      ]},
    {id:'p2',name:'Nyxtara',short:'Nyxtara',cls:'Warlock',color:'#d8b45c',xp:870,caster:'half',slotsUsed:{'1':1},
      spells:[
        {id:'p2s1',name:'Benedizione',level:1,school:'Ammaliamento',desc:'Fino a 3 creature: +1d4 ai tiri per colpire e ai TS. Concentrazione.',prepared:true,expanded:false},
        {id:'p2s2',name:'Punizione Divina',level:1,school:'Invocazione',desc:'Dopo un colpo in mischia: +2d8 danni radianti, +1d8 contro non morti.',prepared:true,expanded:false},
        {id:'p2s3',name:'Individuazione del Male e del Bene',level:1,school:'Divinazione',desc:'Percepisci celestiali, immondi e non morti entro 9 m per 10 minuti.',prepared:false,expanded:false},
        {id:'p2s4',name:'Cura Ferite',level:1,school:'Evocazione',desc:'Tocco: una creatura recupera 1d8 + mod. da incantatore PF.',prepared:false,expanded:false},
      ],
      inventory:[
        {id:'p2i1',name:'Spada lunga +1',qty:1,type:'magico'},
        {id:'p2i2',name:'Scudo',qty:1,type:'equipaggiamento'},
        {id:'p2i3',name:'Simbolo sacro',qty:1,type:'equipaggiamento'},
        {id:'p2i4',name:'Pozione di cura',qty:2,type:'consumabile'},
        {id:'p2i5',name:"Monete d'oro",qty:60,type:'tesoro'},
      ]},
    {id:'p3',name:'Grudalk',short:'Grudalk',cls:'Ranger',color:'#d6647a',xp:870,caster:'full',slotsUsed:{'1':1,'3':1},
      spells:[
        {id:'p3s1',name:'Dardo Incantato',level:1,school:'Invocazione',desc:'Tre dardi luminosi, 1d4+1 danni da forza ciascuno.',prepared:true,expanded:false},
        {id:'p3s2',name:'Scudo',level:1,school:'Abiurazione',desc:'Reazione: +5 alla CA fino al tuo prossimo turno.',prepared:true,expanded:false},
        {id:'p3s3',name:'Identificare',level:1,school:'Divinazione',desc:'Rituale: scopri proprietà e incantesimi legati a un oggetto magico.',prepared:false,expanded:false},
        {id:'p3s4',name:'Invisibilità',level:2,school:'Illusione',desc:'Concentrazione, 1 ora. Invisibile finché non attacca.',prepared:true,expanded:false},
        {id:'p3s5',name:'Controincantesimo',level:3,school:'Abiurazione',desc:'Reazione: interrompi un incantesimo entro 18 m.',prepared:true,expanded:false},
        {id:'p3s6',name:'Palla di Fuoco',level:3,school:'Invocazione',desc:'Sfera di 6 m: 8d6 danni da fuoco, TS su Destrezza per dimezzare.',prepared:true,expanded:false},
      ],
      inventory:[
        {id:'p3i1',name:'Bacchetta arcana',qty:1,type:'magico'},
        {id:'p3i2',name:'Libro degli incantesimi',qty:1,type:'equipaggiamento'},
        {id:'p3i3',name:'Pergamena: Volare',qty:1,type:'magico'},
        {id:'p3i4',name:'Pozione di cura',qty:1,type:'consumabile'},
        {id:'p3i5',name:"Monete d'oro",qty:120,type:'tesoro'},
      ]},
    {id:'p4',name:'Ysdra',short:'Ysdra',cls:'Barbaro',color:'#66c2e3',xp:870,caster:'full',slotsUsed:{'2':1},
      spells:[
        {id:'p4s1',name:'Parola Guaritrice',level:1,school:'Evocazione',desc:'Azione bonus a distanza: una creatura recupera 1d4 + mod. PF.',prepared:true,expanded:false},
        {id:'p4s2',name:'Benedizione',level:1,school:'Ammaliamento',desc:'Fino a 3 creature: +1d4 ai tiri per colpire e ai TS. Concentrazione.',prepared:true,expanded:false},
        {id:'p4s3',name:'Cura Ferite',level:1,school:'Evocazione',desc:'Tocco: una creatura recupera 1d8 + mod. da incantatore PF.',prepared:false,expanded:false},
        {id:'p4s4',name:'Arma Spirituale',level:2,school:'Evocazione',desc:'Crea un\'arma fluttuante: 1d8 + mod. danni da forza.',prepared:true,expanded:false},
        {id:'p4s5',name:'Ristorare Inferiore',level:2,school:'Abiurazione',desc:'Cura una malattia o una condizione.',prepared:false,expanded:false},
      ],
      inventory:[
        {id:'p4i1',name:'Mazza',qty:1,type:'arma'},
        {id:'p4i2',name:"Simbolo sacro d'argento",qty:1,type:'magico'},
        {id:'p4i3',name:'Scudo',qty:1,type:'equipaggiamento'},
        {id:'p4i4',name:'Pozione di cura',qty:3,type:'consumabile'},
        {id:'p4i5',name:"Monete d'oro",qty:75,type:'tesoro'},
      ]},
  ],
  combatants: [
    {id:'k1',name:'Lyra Vesper',init:21,hp:30,maxHp:30,side:'ally'},
    {id:'k2',name:'Sir Aldric',init:18,hp:44,maxHp:52,side:'ally'},
    {id:'k3',name:'Goblin Capo',init:15,hp:22,maxHp:22,side:'enemy'},
    {id:'k4',name:'Goblin',init:12,hp:7,maxHp:7,side:'enemy'},
  ],
  round: 1,
  turnIndex: 0,
  lore: [
    {id:'lo1',name:'Marca di Velmora',subtitle:'Regione',category:'luoghi',text:'Provincia di confine di colline basse e boschi radi. A est gravita su Castelferro, sede della Gilda Mercantile delle Bilance.',revealed:true,expanded:false},
  ],
  loreCatFilter: 'tutti',
  calendar: DEFAULT_CALENDAR,
  lastRoll: null,
  rollSeq: 0,
  history: [],
};

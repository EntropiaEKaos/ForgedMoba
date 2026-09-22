// ============ HERÓIS (12 iniciais + 10 extras + 25 originais = 47) ============
export type AbilitySlot = 'Q' | 'W' | 'E' | 'R';

export interface AbilityDef {
  name: string;
  desc: string;
  cd: number;          // cooldown base (s)
  mana: number;
  range: number;       // alcance de conjuração
  key: string;         // id interno do efeito
  // ===== SISTEMA DE ESCALONAMENTO DE DANOS E ATRIBUTOS =====
  dmgBase?: number;
  dmgPerLevel?: number;
  ratioAd?: number;
  ratioAp?: number;
  ratioArmor?: number;
  ratioMr?: number;
  ratioHp?: number;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  role: string;
  ranged: boolean;
  atkRange: number;
  // stats base (nível 1) + crescimento por nível
  hp: number; hpG: number;
  mp: number; mpG: number;
  ad: number; adG: number;
  armor: number; armorG: number;
  mr: number; mrG: number;
  as: number; asG: number;   // ataques por segundo
  ms: number;                 // move speed
  hpRegen: number; mpRegen: number;
  passive: { name: string; desc: string; key: string };
  abilities: Record<AbilitySlot, AbilityDef>;
  // aparência pixel-art
  look: {
    skin: string; hair: string; armor: string; trim: string; legs: string;
    weapon: 'sword' | 'axe' | 'bow' | 'staff' | 'daggers' | 'fists' | 'blowgun' | 'greatsword';
    weaponColor: string; cape?: string; helmet?: boolean; hood?: boolean; robot?: boolean; furry?: boolean;
    hairStyle: 'short' | 'long' | 'spike' | 'none' | 'twin';
  };
}

export const HEROES: HeroDef[] = [
  {
    id: 'gareth', name: 'Gareth', title: 'O Poder de Demacia', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 620, hpG: 90, mp: 0, mpG: 0, ad: 66, adG: 4.5, armor: 36, armorG: 3.5, mr: 32, mrG: 1.5,
    as: 0.68, asG: 0.02, ms: 108, hpRegen: 8, mpRegen: 0,
    passive: { name: 'Perseverança', desc: 'Fora de combate por 6s, regenera 1,5% da vida máxima por segundo.', key: 'perseverance' },
    abilities: {
      Q: { name: 'Golpe Decisivo', desc: 'Ganha 30% de velocidade e seu próximo ataque causa dano extra e silencia por 1,5s.', cd: 8, mana: 0, range: 0, key: 'decisive' },
      W: { name: 'Coragem', desc: 'Reduz todo o dano recebido em 30% por 4s.', cd: 18, mana: 0, range: 0, key: 'courage' },
      E: { name: 'Julgamento', desc: 'Gira a espada por 3s, causando dano físico em área ao redor.', cd: 10, mana: 0, range: 0, key: 'judgment' },
      R: { name: 'Justiça Demaciana', desc: 'Executa o alvo com dano verdadeiro baseado na vida que falta.', cd: 90, mana: 0, range: 160, key: 'demacian' },
    },
    look: { skin: '#e8b88a', hair: '#6b4a2b', armor: '#3d6bb3', trim: '#e8c860', legs: '#2a3a5c', weapon: 'greatsword', weaponColor: '#cdd6e0', cape: '#2a4a8c', hairStyle: 'short' },
  },
  {
    id: 'anya', name: 'Anya', title: 'A Criança Sombria', role: 'Maga', ranged: true, atkRange: 170,
    hp: 510, hpG: 76, mp: 340, mpG: 45, ad: 50, adG: 2.6, armor: 22, armorG: 3, mr: 30, mrG: 0.8,
    as: 0.6, asG: 0.013, ms: 100, hpRegen: 5.5, mpRegen: 8,
    passive: { name: 'Piromania', desc: 'Após conjurar 4 habilidades, a próxima habilidade atordoa os alvos por 1,5s.', key: 'pyromania' },
    abilities: {
      Q: { name: 'Desintegrar', desc: 'Lança uma bola de fogo. Se abater o alvo, devolve o custo de mana e metade da recarga.', cd: 4, mana: 60, range: 210, key: 'disintegrate' },
      W: { name: 'Incinerar', desc: 'Cone de fogo que causa dano mágico a todos os inimigos atingidos.', cd: 8, mana: 70, range: 180, key: 'incinerate' },
      E: { name: 'Escudo Fundido', desc: 'Escudo que reduz dano e queima quem te atacar corpo a corpo.', cd: 10, mana: 40, range: 0, key: 'moltenshield' },
      R: { name: 'Invocar: Ursito', desc: 'Invoca Ursito num impacto flamejante em área, deixando o chão em chamas.', cd: 100, mana: 100, range: 190, key: 'tibbers' },
    },
    look: { skin: '#f2cba8', hair: '#d94f7e', armor: '#7a2e5c', trim: '#e8a0c0', legs: '#4a1e3a', weapon: 'staff', weaponColor: '#8a5a2e', hairStyle: 'twin' },
  },
  {
    id: 'ashka', name: 'Ashka', title: 'A Arqueira do Gelo', role: 'Atiradora', ranged: true, atkRange: 190,
    hp: 540, hpG: 84, mp: 280, mpG: 32, ad: 61, adG: 3.2, armor: 24, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.65, asG: 0.033, ms: 103, hpRegen: 4, mpRegen: 6,
    passive: { name: 'Foco Gélido', desc: 'Ataques básicos congelam o alvo, reduzindo a velocidade dele em 20% por 2s.', key: 'frostshot' },
    abilities: {
      Q: { name: 'Fúria da Patrulheira', desc: 'Ganha 50% de velocidade de ataque por 4s e flechas cortam mais fundo.', cd: 14, mana: 50, range: 0, key: 'rangerfocus' },
      W: { name: 'Salva de Flechas', desc: 'Dispara um leque de 7 flechas que causam dano e lentidão forte.', cd: 9, mana: 60, range: 230, key: 'volley' },
      E: { name: 'Falcão Explorador', desc: 'Envia um falcão que revela a área alvo no minimapa.', cd: 30, mana: 30, range: 9999, key: 'hawkshot' },
      R: { name: 'Flecha de Cristal', desc: 'Flecha global gigante que atordoa o primeiro herói atingido (mais tempo quanto mais longe).', cd: 90, mana: 100, range: 9999, key: 'crystalarrow' },
    },
    look: { skin: '#f0d5c0', hair: '#eef3fa', armor: '#2e6e8c', trim: '#9adcf0', legs: '#1e4a5e', weapon: 'bow', weaponColor: '#bfe8f5', cape: '#d0e8f0', hood: true, hairStyle: 'long' },
  },
  {
    id: 'yamir', name: 'Yamir', title: 'O Espadachim Wuju', role: 'Assassino', ranged: false, atkRange: 55,
    hp: 570, hpG: 92, mp: 250, mpG: 40, ad: 66, adG: 3.5, armor: 33, armorG: 3, mr: 32, mrG: 1.3,
    as: 0.72, asG: 0.028, ms: 111, hpRegen: 7.5, mpRegen: 7,
    passive: { name: 'Golpe Duplo', desc: 'A cada 4 ataques básicos, o próximo ataque acerta duas vezes.', key: 'doublestrike' },
    abilities: {
      Q: { name: 'Golpe Alfa', desc: 'Fica intocável e corta o alvo e inimigos próximos com velocidade extrema.', cd: 13, mana: 60, range: 200, key: 'alphastrike' },
      W: { name: 'Meditar', desc: 'Canaliza, restaurando vida e reduzindo dano recebido por 3s.', cd: 28, mana: 50, range: 0, key: 'meditate' },
      E: { name: 'Estilo Wuju', desc: 'Seus ataques causam dano verdadeiro adicional por 5s.', cd: 14, mana: 0, range: 0, key: 'wuju' },
      R: { name: 'Highlander', desc: '+40% velocidade de movimento e ataque por 8s. Abates estendem a duração.', cd: 75, mana: 100, range: 0, key: 'highlander' },
    },
    look: { skin: '#d9a878', hair: '#2b2b2b', armor: '#5c3a8c', trim: '#e8c860', legs: '#3a2a5c', weapon: 'sword', weaponColor: '#b8e0d0', helmet: true, hairStyle: 'none' },
  },
  {
    id: 'rizar', name: 'Rizar', title: 'O Mago Rúnico', role: 'Mago', ranged: true, atkRange: 165,
    hp: 560, hpG: 88, mp: 400, mpG: 60, ad: 52, adG: 3, armor: 25, armorG: 3.5, mr: 30, mrG: 0.8,
    as: 0.62, asG: 0.014, ms: 102, hpRegen: 6, mpRegen: 9,
    passive: { name: 'Maestria Arcana', desc: 'Conjurar uma habilidade reduz em 1s a recarga das outras habilidades.', key: 'arcanemastery' },
    abilities: {
      Q: { name: 'Sobrecarga', desc: 'Projétil rúnico veloz que causa dano mágico (escala com mana máxima).', cd: 3.5, mana: 40, range: 210, key: 'overload' },
      W: { name: 'Prisão Rúnica', desc: 'Prende o alvo no lugar por 1,5s e causa dano mágico.', cd: 12, mana: 70, range: 180, key: 'runeprison' },
      E: { name: 'Fluxo de Feitiço', desc: 'Orbe que causa dano e reduz a resistência mágica do alvo.', cd: 9, mana: 60, range: 190, key: 'spellflux' },
      R: { name: 'Poder Dessecado', desc: 'Por 6s suas habilidades causam dano em área e você ganha velocidade.', cd: 70, mana: 0, range: 0, key: 'desperatepower' },
    },
    look: { skin: '#7ea6d9', hair: '#e0e0e0', armor: '#8c2e2e', trim: '#e8c860', legs: '#5c1e1e', weapon: 'fists', weaponColor: '#b090ff', hairStyle: 'short' },
  },
  {
    id: 'timo', name: 'Timo', title: 'O Explorador Veloz', role: 'Atirador', ranged: true, atkRange: 170,
    hp: 520, hpG: 80, mp: 270, mpG: 40, ad: 54, adG: 3, armor: 24, armorG: 3.5, mr: 30, mrG: 0.5,
    as: 0.69, asG: 0.033, ms: 110, hpRegen: 5, mpRegen: 6.5,
    passive: { name: 'Camuflagem', desc: 'Parado por 2,5s, fica invisível para inimigos. Ao sair, ganha velocidade de ataque.', key: 'camouflage' },
    abilities: {
      Q: { name: 'Dardo Ofuscante', desc: 'Cega o alvo por 2s: os ataques básicos dele erram.', cd: 8, mana: 60, range: 190, key: 'blindingdart' },
      W: { name: 'Mover Rápido!', desc: 'Ganha 40% de velocidade de movimento por 4s.', cd: 17, mana: 40, range: 0, key: 'movequick' },
      E: { name: 'Ataque Tóxico', desc: 'Ataques envenenam o alvo, causando dano por 4s (passiva/ativa por 6s).', cd: 11, mana: 40, range: 0, key: 'toxicshot' },
      R: { name: 'Armadilha Venenosa', desc: 'Planta um cogumelo invisível que explode em veneno lento e mortal.', cd: 30, mana: 75, range: 120, key: 'shroom' },
    },
    look: { skin: '#e8c8a0', hair: '#e8e0d0', armor: '#3e7a3e', trim: '#c8a05a', legs: '#2a4a2a', weapon: 'blowgun', weaponColor: '#7a5a3a', furry: true, hairStyle: 'short' },
  },
  {
    id: 'luxana', name: 'Luxana', title: 'A Dama Luminosa', role: 'Maga', ranged: true, atkRange: 175,
    hp: 500, hpG: 75, mp: 330, mpG: 48, ad: 50, adG: 2.7, armor: 21, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.63, asG: 0.014, ms: 103, hpRegen: 5, mpRegen: 8,
    passive: { name: 'Iluminação', desc: 'Habilidades marcam o alvo; seu próximo ataque detona a marca com dano mágico extra.', key: 'illumination' },
    abilities: {
      Q: { name: 'Ligação da Luz', desc: 'Esfera de luz que prende até 2 inimigos por 1,5s.', cd: 11, mana: 60, range: 230, key: 'lightbinding' },
      W: { name: 'Barreira Prismática', desc: 'Bastão que protege você e aliados próximos com um escudo.', cd: 14, mana: 60, range: 200, key: 'prismatic' },
      E: { name: 'Singularidade Lucente', desc: 'Zona de luz que causa lentidão e explode com dano mágico.', cd: 10, mana: 70, range: 220, key: 'lucent' },
      R: { name: 'Centelha Final', desc: 'Dispara um laser devastador em linha reta de longuíssimo alcance.', cd: 60, mana: 100, range: 700, key: 'finalspark' },
    },
    look: { skin: '#f5d9b8', hair: '#f0dc82', armor: '#e8e4f0', trim: '#e8c034', legs: '#c0b8d8', weapon: 'staff', weaponColor: '#e8c034', hairStyle: 'long' },
  },
  {
    id: 'darion', name: 'Darion', title: 'A Mão de Noxus', role: 'Lutador', ranged: false, atkRange: 60,
    hp: 640, hpG: 100, mp: 260, mpG: 38, ad: 64, adG: 5, armor: 39, armorG: 4, mr: 32, mrG: 1.3,
    as: 0.63, asG: 0.02, ms: 105, hpRegen: 10, mpRegen: 6.5,
    passive: { name: 'Hemorragia', desc: 'Ataques e habilidades fazem o alvo sangrar (acumula 5x), causando dano físico por 5s.', key: 'hemorrhage' },
    abilities: {
      Q: { name: 'Dizimar', desc: 'Gira o machado num círculo, causando dano e curando por herói atingido.', cd: 9, mana: 40, range: 0, key: 'decimate' },
      W: { name: 'Golpe Mutilante', desc: 'Próximo ataque causa dano aumentado e lentidão de 90% por 1s.', cd: 7, mana: 30, range: 0, key: 'cripplingstrike' },
      E: { name: 'Apreender', desc: 'Puxa os inimigos à sua frente com o gancho do machado.', cd: 17, mana: 45, range: 150, key: 'apprehend' },
      R: { name: 'Guilhotina Noxiana', desc: 'Salta e causa dano VERDADEIRO (aumenta com sangramentos). Abates zeram a recarga.', cd: 100, mana: 100, range: 140, key: 'guillotine' },
    },
    look: { skin: '#d9a888', hair: '#2b2b2b', armor: '#5c2626', trim: '#8c8c94', legs: '#3a1a1a', weapon: 'axe', weaponColor: '#c0c8d0', cape: '#3a0e0e', hairStyle: 'short' },
  },
  {
    id: 'katya', name: 'Katya', title: 'A Adaga Sinistra', role: 'Assassina', ranged: false, atkRange: 55,
    hp: 550, hpG: 84, mp: 0, mpG: 0, ad: 62, adG: 3.5, armor: 28, armorG: 3.5, mr: 32, mrG: 1.3,
    as: 0.66, asG: 0.027, ms: 110, hpRegen: 7.5, mpRegen: 0,
    passive: { name: 'Voracidade', desc: 'Abates e assistências reduzem TODAS as suas recargas em 12s.', key: 'voracity' },
    abilities: {
      Q: { name: 'Adaga Saltitante', desc: 'Adaga que ricocheteia em até 3 inimigos próximos.', cd: 8, mana: 0, range: 200, key: 'bouncingblade' },
      W: { name: 'Aço Sinistro', desc: 'Gira as adagas ao redor, causa dano e ganha velocidade.', cd: 7, mana: 0, range: 0, key: 'sinistersteel' },
      E: { name: 'Shunpo', desc: 'Teleporta instantaneamente até o local alvo, causando dano ao chegar.', cd: 10, mana: 0, range: 220, key: 'shunpo' },
      R: { name: 'Lótus da Morte', desc: 'Canaliza uma tempestade de adagas, atingindo até 3 heróis próximos repetidamente.', cd: 75, mana: 0, range: 0, key: 'deathlotus' },
    },
    look: { skin: '#f0c8a8', hair: '#c03030', armor: '#2b2b33', trim: '#8c3a3a', legs: '#1c1c24', weapon: 'daggers', weaponColor: '#d0d8e0', hairStyle: 'long' },
  },
  {
    id: 'blitz', name: 'Blitz', title: 'O Golem a Vapor', role: 'Tanque', ranged: false, atkRange: 60,
    hp: 650, hpG: 105, mp: 270, mpG: 40, ad: 62, adG: 3.5, armor: 40, armorG: 4.5, mr: 32, mrG: 1.3,
    as: 0.62, asG: 0.011, ms: 105, hpRegen: 8.5, mpRegen: 8.5,
    passive: { name: 'Barreira de Mana', desc: 'Com pouca vida, ganha um escudo igual a 50% da sua mana atual (recarga 90s).', key: 'manabarrier' },
    abilities: {
      Q: { name: 'Puxão Foguete', desc: 'Dispara a mão direita, puxando o primeiro inimigo atingido até você.', cd: 16, mana: 80, range: 260, key: 'rocketgrab' },
      W: { name: 'Sobrecarregar', desc: 'Supercarrega: +70% velocidade de ataque e +30% de movimento por 5s.', cd: 15, mana: 50, range: 0, key: 'overdrive' },
      E: { name: 'Punho de Força', desc: 'Próximo ataque causa dano dobrado e arremessa o alvo ao ar (1s).', cd: 9, mana: 25, range: 0, key: 'powerfist' },
      R: { name: 'Campo Estático', desc: 'Explosão de raios que causa dano mágico e SILENCIA inimigos próximos.', cd: 60, mana: 100, range: 0, key: 'staticfield' },
    },
    look: { skin: '#d9a860', hair: '#000000', armor: '#c8922e', trim: '#7a5a1e', legs: '#8c6a26', weapon: 'fists', weaponColor: '#e0b040', robot: true, hairStyle: 'none' },
  },
  {
    id: 'warrik', name: 'Warrik', title: 'O Lobo de Zaun', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 620, hpG: 98, mp: 240, mpG: 35, ad: 64, adG: 3.3, armor: 33, armorG: 3.5, mr: 32, mrG: 1.3,
    as: 0.64, asG: 0.023, ms: 107, hpRegen: 9, mpRegen: 7,
    passive: { name: 'Fome Eterna', desc: 'Ataques básicos causam dano mágico extra e curam metade desse valor.', key: 'eternalhunger' },
    abilities: {
      Q: { name: 'Golpes Famintos', desc: 'Morde o alvo, causando dano baseado na vida máxima dele e curando você.', cd: 8, mana: 60, range: 70, key: 'hungeringstrike' },
      W: { name: 'Caçada Sangrenta', desc: 'Fareja a presa: +velocidade de ataque, e +movimento contra alvos feridos.', cd: 16, mana: 40, range: 0, key: 'bloodscent' },
      E: { name: 'Uivo Aterrorizante', desc: 'Uivo que APAVORA inimigos próximos, fazendo-os fugir por 1s.', cd: 15, mana: 50, range: 0, key: 'terrorhowl' },
      R: { name: 'Sepultura Infinita', desc: 'Salta no alvo, suprimindo-o por 1,8s com uma sequência de golpes que curam você.', cd: 90, mana: 100, range: 200, key: 'infiniteduress' },
    },
    look: { skin: '#8c98a8', hair: '#5c6878', armor: '#4a3260', trim: '#8c6ab0', legs: '#2e1e40', weapon: 'fists', weaponColor: '#c0ccd8', furry: true, hairStyle: 'spike' },
  },
  {
    id: 'morgause', name: 'Morgause', title: 'A Anja Caída', role: 'Suporte', ranged: true, atkRange: 165,
    hp: 560, hpG: 88, mp: 340, mpG: 60, ad: 52, adG: 3.5, armor: 25, armorG: 3.8, mr: 30, mrG: 0.5,
    as: 0.58, asG: 0.015, ms: 102, hpRegen: 5.5, mpRegen: 8,
    passive: { name: 'Sifão de Almas', desc: 'O dano das suas habilidades cura você em 20% do valor causado.', key: 'soulsiphon' },
    abilities: {
      Q: { name: 'Aprisionamento Sombrio', desc: 'Projétil sombrio que PRENDE o alvo por 2s.', cd: 10, mana: 60, range: 230, key: 'darkbinding' },
      W: { name: 'Solo Atormentado', desc: 'Amaldiçoa o chão, causando dano mágico contínuo por 5s.', cd: 10, mana: 70, range: 200, key: 'tormentedsoil' },
      E: { name: 'Escudo Negro', desc: 'Escudo mágico em um aliado que bloqueia dano mágico e controle de grupo.', cd: 20, mana: 50, range: 200, key: 'blackshield' },
      R: { name: 'Correntes de Alma', desc: 'Correntes atingem heróis próximos; após 1,5s, quem continuar preso é atordoado.', cd: 100, mana: 100, range: 0, key: 'soulshackles' },
    },
    look: { skin: '#e8d0e0', hair: '#6a3a8c', armor: '#2e1e3e', trim: '#b090d0', legs: '#1e1230', weapon: 'staff', weaponColor: '#5c3a7c', cape: '#3a2a50', hairStyle: 'long' },
  },
  // ============ 10 HERÓIS EXTRAS ============
  {
    id: 'jaina', name: 'Jaina', title: 'A Feiticeira do Gelo', role: 'Maga', ranged: true, atkRange: 175,
    hp: 520, hpG: 80, mp: 360, mpG: 55, ad: 50, adG: 2.8, armor: 22, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.014, ms: 104, hpRegen: 5.5, mpRegen: 8.5,
    passive: { name: 'Toque Gélido', desc: 'Habilidades reduzem a velocidade do alvo em 25% por 2s.', key: 'frosttouch' },
    abilities: {
      Q: { name: 'Flecha de Gelo', desc: 'Projétil que causa dano e congela o alvo por 1s.', cd: 7, mana: 50, range: 220, key: 'frostarrow' },
      W: { name: 'Anel de Gelo', desc: 'Cria um anel que congela inimigos próximos por 1,5s.', cd: 11, mana: 70, range: 0, key: 'frostring' },
      E: { name: 'Tempestade de Neve', desc: 'Chuva de gelo em área causando dano contínuo por 3s.', cd: 10, mana: 60, range: 200, key: 'blizzard' },
      R: { name: 'Prisão Congelante', desc: 'Congela um herói por 3s causando dano massivo.', cd: 90, mana: 100, range: 200, key: 'freeze' },
    },
    look: { skin: '#e8d8e0', hair: '#d0e8f0', armor: '#3a5a8c', trim: '#b0d8f0', legs: '#2a3a5c', weapon: 'staff', weaponColor: '#80c0e0', cape: '#4a6a9c', hairStyle: 'long' },
  },
  {
    id: 'thresk', name: 'Thresk', title: 'O Guardião das Correntes', role: 'Suporte', ranged: false, atkRange: 55,
    hp: 600, hpG: 95, mp: 300, mpG: 45, ad: 58, adG: 3.5, armor: 38, armorG: 4, mr: 32, mrG: 1.3,
    as: 0.63, asG: 0.02, ms: 105, hpRegen: 8, mpRegen: 7,
    passive: { name: 'Colheita de Almas', desc: 'Abates e assistências coletam almas, aumentando seu dano de habilidade permanentemente.', key: 'soulharvest' },
    abilities: {
      Q: { name: 'Corrente da Morte', desc: 'Dispara uma corrente que puxa o primeiro inimigo atingido até você.', cd: 14, mana: 70, range: 280, key: 'deathhook' },
      W: { name: 'Prisão Sombria', desc: 'Cria uma gaiola que impede o alvo de sair de uma área por 2s.', cd: 16, mana: 60, range: 180, key: 'darkcage' },
      E: { name: 'Puxão', desc: 'Puxa todos os inimigos próximos em sua direção.', cd: 12, mana: 50, range: 0, key: 'flay' },
      R: { name: 'O Portal', desc: 'Invoca um portal que teleporta você e um aliado para qualquer lugar visível.', cd: 120, mana: 100, range: 600, key: 'gate' },
    },
    look: { skin: '#8a9aaa', hair: '#1a1a1a', armor: '#2a2a34', trim: '#5a8a5a', legs: '#1a1a24', weapon: 'greatsword', weaponColor: '#6a8a6a', cape: '#3a3a44', hood: true, hairStyle: 'none' },
  },
  {
    id: 'jinxara', name: 'Jinxara', title: 'A Atiradora da Caçada', role: 'Atiradora', ranged: true, atkRange: 185,
    hp: 530, hpG: 82, mp: 260, mpG: 35, ad: 58, adG: 3.4, armor: 23, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.66, asG: 0.03, ms: 108, hpRegen: 4.5, mpRegen: 6.5,
    passive: { name: 'Get Excited!', desc: 'Abates e assistências aumentam sua velocidade de movimento em 60% por 6s.', key: 'getexcited' },
    abilities: {
      Q: { name: 'Trocar!', desc: 'Alterna entre Minigun (vel. ataque) e Canhão de Foguetes (alcance + dano em área).', cd: 1, mana: 0, range: 0, key: 'switcheroo' },
      W: { name: 'Zap!', desc: 'Dispara um raio que causa dano e revela o alvo.', cd: 8, mana: 50, range: 260, key: 'zap' },
      E: { name: 'Mordida de Flamejante', desc: 'Lança armadilhas que explodem em área causando dano e lentidão.', cd: 12, mana: 60, range: 180, key: 'flamechompers' },
      R: { name: 'Super Mega Foguete', desc: 'Foguete global que causa dano massivo ao primeiro herói atingido.', cd: 80, mana: 100, range: 9999, key: 'superrocket' },
    },
    look: { skin: '#e8c8a8', hair: '#4a8a4a', armor: '#5a3a8c', trim: '#e0a040', legs: '#3a2a5c', weapon: 'bow', weaponColor: '#c04040', hairStyle: 'twin' },
  },
  {
    id: 'yasuke', name: 'Yasuke', title: 'O Espadachim Errante', role: 'Assassino', ranged: false, atkRange: 55,
    hp: 560, hpG: 88, mp: 280, mpG: 40, ad: 60, adG: 3.5, armor: 30, armorG: 3.2, mr: 32, mrG: 1.3,
    as: 0.68, asG: 0.028, ms: 112, hpRegen: 7, mpRegen: 7,
    passive: { name: 'Escudo de Espírito', desc: 'A cada poucos segundos, ganha um escudo que absorve dano. Movimento o recarrega.', key: 'spiritshield' },
    abilities: {
      Q: { name: 'Lâmina de Aço', desc: 'Dispara uma lâmina que causa dano e pode ser pega de volta para reduzir o CD.', cd: 6, mana: 0, range: 200, key: 'steelblade' },
      W: { name: 'Parede de Vento', desc: 'Cria uma muralha que bloqueia projéteis por 4s.', cd: 18, mana: 40, range: 0, key: 'windwall' },
      E: { name: 'Dança da Espada', desc: 'Teleporta através de um inimigo, causando dano e marcando-o.', cd: 10, mana: 30, range: 180, key: 'sweepingblade' },
      R: { name: 'Último Suspiro', desc: 'Salta em um alvo arremessado, causando dano massivo e prendendo-o.', cd: 80, mana: 100, range: 220, key: 'lastbreath' },
    },
    look: { skin: '#d9a878', hair: '#1a1a1a', armor: '#3a2a5c', trim: '#e8c860', legs: '#2a1a4c', weapon: 'sword', weaponColor: '#b8e0d0', hairStyle: 'spike' },
  },
  {
    id: 'zedric', name: 'Zedric', title: 'O Mestre das Sombras', role: 'Assassino', ranged: false, atkRange: 55,
    hp: 580, hpG: 90, mp: 220, mpG: 35, ad: 64, adG: 3.8, armor: 32, armorG: 3.5, mr: 32, mrG: 1.3,
    as: 0.66, asG: 0.028, ms: 110, hpRegen: 7.5, mpRegen: 6.5,
    passive: { name: 'Marca da Sombra', desc: 'Ataques e habilidades marcam o alvo; após 3s, a marca detona causando dano.', key: 'shadowmark' },
    abilities: {
      Q: { name: 'Lâminas Giratórias', desc: 'Dispara 3 lâminas que causam dano e voltam para você.', cd: 7, mana: 60, range: 220, key: 'razorshuriken' },
      W: { name: 'Viver à Sombra', desc: 'Invoca uma sombra que troca de lugar com você e replica suas habilidades.', cd: 14, mana: 40, range: 200, key: 'livingshadow' },
      E: { name: 'Corte Sombrio', desc: 'Gira as lâminas causando dano e lentidão em área.', cd: 9, mana: 50, range: 0, key: 'shadowslash' },
      R: { name: 'Projeto: Morte', desc: 'Marca o alvo e torna-se intocável; após 3s, a marca causa dano massivo.', cd: 75, mana: 100, range: 200, key: 'deathmark' },
    },
    look: { skin: '#d9a878', hair: '#1a1a1a', armor: '#2a1a3c', trim: '#c04040', legs: '#1a0a2c', weapon: 'daggers', weaponColor: '#c04040', helmet: true, hairStyle: 'none' },
  },
  {
    id: 'sonara', name: 'Sonara', title: 'A Búfola da Tempestade', role: 'Maga', ranged: true, atkRange: 170,
    hp: 540, hpG: 84, mp: 380, mpG: 58, ad: 52, adG: 3, armor: 23, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.64, asG: 0.014, ms: 105, hpRegen: 6, mpRegen: 9,
    passive: { name: 'Canto da Tempestade', desc: 'A cada 3 habilidades conjuradas, ganha escudo e velocidade de movimento.', key: 'stormsong' },
    abilities: {
      Q: { name: 'Sino de Prata', desc: 'Projétil que causa dano e cura você.', cd: 6, mana: 45, range: 220, key: 'silversona' },
      W: { name: 'Canto da Velocidade', desc: 'Aumenta a velocidade de ataque e movimento de aliados próximos.', cd: 12, mana: 50, range: 0, key: 'haste' },
      E: { name: 'Onda Sonora', desc: 'Onda que causa dano e silencia inimigos em área.', cd: 10, mana: 60, range: 180, key: 'sonicwave' },
      R: { name: 'Crescendo', desc: 'Canaliza um feixe sonoro que causa dano massivo e atordoa.', cd: 100, mana: 100, range: 260, key: 'crescendo' },
    },
    look: { skin: '#e8c8a8', hair: '#e8c040', armor: '#3a4a8c', trim: '#e8c040', legs: '#2a3a6c', weapon: 'staff', weaponColor: '#e8c040', hairStyle: 'long' },
  },
  {
    id: 'garen', name: 'Garen', title: 'O Poder de Demacia', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 640, hpG: 95, mp: 0, mpG: 0, ad: 68, adG: 4.8, armor: 38, armorG: 3.8, mr: 32, mrG: 1.5,
    as: 0.66, asG: 0.02, ms: 108, hpRegen: 9, mpRegen: 0,
    passive: { name: 'Perseverança', desc: 'Fora de combate por 6s, regenera 1,5% da vida máxima por segundo.', key: 'perseverance' },
    abilities: {
      Q: { name: 'Golpe Decisivo', desc: 'Ganha 30% de velocidade e seu próximo ataque causa dano extra e silencia por 1,5s.', cd: 8, mana: 0, range: 0, key: 'decisive' },
      W: { name: 'Coragem', desc: 'Reduz todo o dano recebido em 30% por 4s.', cd: 18, mana: 0, range: 0, key: 'courage' },
      E: { name: 'Julgamento', desc: 'Gira a espada por 3s, causando dano físico em área ao redor.', cd: 10, mana: 0, range: 0, key: 'judgment' },
      R: { name: 'Justiça Demaciana', desc: 'Executa o alvo com dano verdadeiro baseado na vida que falta.', cd: 90, mana: 0, range: 160, key: 'demacian' },
    },
    look: { skin: '#e8b88a', hair: '#6b4a2b', armor: '#3d6bb3', trim: '#e8c860', legs: '#2a3a5c', weapon: 'greatsword', weaponColor: '#cdd6e0', cape: '#2a4a8c', hairStyle: 'short' },
  },
  {
    id: 'malzahar', name: 'Malzahar', title: 'O Profeta do Vazio', role: 'Maga', ranged: true, atkRange: 170,
    hp: 550, hpG: 86, mp: 380, mpG: 60, ad: 52, adG: 3, armor: 24, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.014, ms: 102, hpRegen: 6, mpRegen: 9,
    passive: { name: 'Escudo do Vazio', desc: 'A cada 30s, ganha um escudo que bloqueia uma habilidade inimiga.', key: 'voidshield' },
    abilities: {
      Q: { name: 'Chamado do Vazio', desc: 'Abre uma fenda que causa dano e silencia inimigos em área.', cd: 8, mana: 60, range: 220, key: 'voidcall' },
      W: { name: 'Porta do Vazio', desc: 'Invoca um portal que gera lacaios do vazio por 8s.', cd: 16, mana: 70, range: 180, key: 'voidgate' },
      E: { name: 'Sussurros do Vazio', desc: 'Espalha uma praga que causa dano contínuo e pula entre inimigos.', cd: 10, mana: 50, range: 200, key: 'voidwhispers' },
      R: { name: 'Nether Grasp', desc: 'Canaliza e suprime um alvo por 2,5s causando dano massivo.', cd: 100, mana: 100, range: 180, key: 'nethergrasp' },
    },
    look: { skin: '#a898b8', hair: '#3a2a4c', armor: '#2a1a3c', trim: '#8040c0', legs: '#1a0a2c', weapon: 'staff', weaponColor: '#8040c0', hood: true, hairStyle: 'none' },
  },
  {
    id: 'nidalee', name: 'Nidalee', title: 'A Caçadora Bestial', role: 'Atiradora', ranged: true, atkRange: 175,
    hp: 540, hpG: 84, mp: 280, mpG: 40, ad: 56, adG: 3.2, armor: 24, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.66, asG: 0.028, ms: 110, hpRegen: 5, mpRegen: 7,
    passive: { name: 'Prowl', desc: 'Entrar na selva concede velocidade de movimento e dano bônus no próximo ataque.', key: 'prowl' },
    abilities: {
      Q: { name: 'Lança Arremessada', desc: 'Lança que causa dano massivo a longa distância.', cd: 6, mana: 50, range: 280, key: 'javelin' },
      W: { name: 'Armadilha de Bushwhack', desc: 'Planta armadilhas que revelam e causam dano.', cd: 10, mana: 40, range: 160, key: 'bushwhack' },
      E: { name: 'Cura Primordial', desc: 'Cura um aliado ou causa dano a um inimigo.', cd: 8, mana: 50, range: 180, key: 'primalheal' },
      R: { name: 'Forma de Puma', desc: 'Transforma-se em puma: ganha velocidade e habilidades corpo a corpo por 10s.', cd: 80, mana: 100, range: 0, key: 'pumaform' },
    },
    look: { skin: '#d9a878', hair: '#3a2a1a', armor: '#5a4a2a', trim: '#e8c860', legs: '#3a2a1a', weapon: 'blowgun', weaponColor: '#8a6a3a', hairStyle: 'long' },
  },
  {
    id: 'akali', name: 'Akali', title: 'A Punho de Ferro', role: 'Assassina', ranged: false, atkRange: 55,
    hp: 570, hpG: 90, mp: 200, mpG: 30, ad: 62, adG: 3.6, armor: 30, armorG: 3.3, mr: 32, mrG: 1.3,
    as: 0.68, asG: 0.028, ms: 112, hpRegen: 7.5, mpRegen: 6,
    passive: { name: 'Disciplina da Associação', desc: 'A cada 2 ataques, o próximo causa dano mágico extra.', key: 'discipline' },
    abilities: {
      Q: { name: 'Lâmina Voraz', desc: 'Lança uma shuriken que causa dano e retorna.', cd: 6, mana: 50, range: 200, key: 'voraxblade' },
      W: { name: 'Fumaça', desc: 'Cria uma nuvem que a torna invisível por 4s.', cd: 16, mana: 60, range: 0, key: 'smokebomb' },
      E: { name: 'Dança das Lâminas', desc: 'Salta em um alvo causando dano e pode ser reusada.', cd: 10, mana: 40, range: 180, key: 'shurikenflip' },
      R: { name: 'Execução', desc: 'Salta e causa dano massivo; abates resetam o CD.', cd: 70, mana: 100, range: 220, key: 'execution' },
    },
    look: { skin: '#e8c8a8', hair: '#1a1a1a', armor: '#3a1a2c', trim: '#e04040', legs: '#2a0a1c', weapon: 'daggers', weaponColor: '#e04040', hairStyle: 'long' },
  },
  {
    id: 'braum', name: 'Braum', title: 'O Coração de Freljord', role: 'Tanque', ranged: false, atkRange: 55,
    hp: 680, hpG: 110, mp: 280, mpG: 42, ad: 60, adG: 3.5, armor: 42, armorG: 4.5, mr: 32, mrG: 1.3,
    as: 0.62, asG: 0.018, ms: 104, hpRegen: 9, mpRegen: 7,
    passive: { name: 'Colisão Congelante', desc: 'Ataques básicos marcam o alvo; 4 marcas atordoam por 1s.', key: 'frozenstrike' },
    abilities: {
      Q: { name: 'Quebra-gelo', desc: 'Lança um fragmento de gelo que causa dano e lentidão.', cd: 9, mana: 60, range: 240, key: 'icebreak' },
      W: { name: 'Apoio', desc: 'Salta para um aliado, dando-lhe escudo e armadura.', cd: 14, mana: 50, range: 200, key: 'standbehind' },
      E: { name: 'Escudo Glacial', desc: 'Levanta o escudo, bloqueando projéteis por 3s.', cd: 16, mana: 60, range: 0, key: 'glacialfence' },
      R: { name: 'Tremor Congelante', desc: 'Salta e cria uma onda de gelo que atordoa e causa dano em área.', cd: 110, mana: 100, range: 0, key: 'glacialtremor' },
    },
    look: { skin: '#d9a878', hair: '#c8a060', armor: '#3a4a6c', trim: '#80c0e0', legs: '#2a3a5c', weapon: 'greatsword', weaponColor: '#a0c0e0', hairStyle: 'short' },
  },
];

// Importa e mescla os 25 heróis originais (conceitos únicos, não-LoL)
import { ORIGINAL_HEROES } from './heroes-original';
HEROES.push(...ORIGINAL_HEROES);

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map(h => [h.id, h]));

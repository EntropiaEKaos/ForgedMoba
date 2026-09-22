// ============ 25 HERÓIS ORIGINAIS (conceitos únicos, não-LoL) ============
import type { HeroDef } from './heroes';

// Helper para reduzir verbosidade
type L = HeroDef['look'];

export const ORIGINAL_HEROES: HeroDef[] = [
  // 1. VOLCARN — Golem de Magma (Lutador)
  {
    id: 'volcarn', name: 'Volcarn', title: 'O Coração de Magma', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 650, hpG: 96, mp: 300, mpG: 42, ad: 64, adG: 4, armor: 36, armorG: 4, mr: 32, mrG: 1.3,
    as: 0.64, asG: 0.022, ms: 106, hpRegen: 9, mpRegen: 6.5,
    passive: { name: 'Coração Ardente', desc: 'Ataques causam dano de queimadura extra ao longo do tempo.', key: 'magmaheart' },
    abilities: {
      Q: { name: 'Punho Vulcânico', desc: 'Avança e golpeia, causando dano e deixando o chão em chamas.', cd: 8, mana: 50, range: 0, key: 'magmadash' },
      W: { name: 'Pele de Rocha', desc: 'Reduz o dano recebido e reflete dano aos atacantes por 4s.', cd: 16, mana: 60, range: 0, key: 'stonehide' },
      E: { name: 'Erupção de Brasas', desc: 'Cospe brasas em cone, causando dano mágico e lentidão.', cd: 10, mana: 55, range: 170, key: 'embercone' },
      R: { name: 'Despertar do Vulcão', desc: 'Explode em uma erupção massiva que causa dano e empurra inimigos.', cd: 100, mana: 100, range: 0, key: 'volcanoerupt' },
    },
    look: { skin: '#c8703a', hair: '#3a1a0a', armor: '#8c3020', trim: '#ff8030', legs: '#5c1810', weapon: 'fists', weaponColor: '#ff6020', helmet: true, hairStyle: 'none' } as L,
  },
  // 2. AETHEL — Cavaleira dos Ventos (Atiradora montada)
  {
    id: 'aethel', name: 'Aethel', title: 'A Cavaleira dos Ventos', role: 'Atiradora', ranged: true, atkRange: 195,
    hp: 540, hpG: 84, mp: 250, mpG: 35, ad: 60, adG: 3.3, armor: 23, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.66, asG: 0.032, ms: 112, hpRegen: 5, mpRegen: 6.5,
    passive: { name: 'Corrente de Ar', desc: 'Mover aumenta sua velocidade de ataque, parando reinicia.', key: 'windflow' },
    abilities: {
      Q: { name: 'Lança Furacão', desc: 'Arremessa uma lança perfurante que atinge todos no caminho.', cd: 7, mana: 50, range: 260, key: 'hurlspear' },
      W: { name: 'Rajada', desc: 'Cria uma onda de vento que empurra inimigos e a impulsiona.', cd: 14, mana: 55, range: 0, key: 'gust' },
      E: { name: 'Cauda de Tornado', desc: 'Deixa um redemoinho que causa dano e lentidão aos inimigos.', cd: 12, mana: 60, range: 200, key: 'tornado' },
      R: { name: 'Tempestade Celeste', desc: 'Invoca uma tempestade massiva que persegue inimigos por 6s.', cd: 95, mana: 100, range: 250, key: 'skytempest' },
    },
    look: { skin: '#e8c8a8', hair: '#f0e8a0', armor: '#3a8ab0', trim: '#a0e8f0', legs: '#2a5a70', weapon: 'staff', weaponColor: '#c8e8f0', cape: '#5090b0', hairStyle: 'long' } as L,
  },
  // 3. COGSWORTH — Autômato de Relógio (Tanque)
  {
    id: 'cogsworth', name: 'Cogsworth', title: 'O Autômato Tique-Taque', role: 'Tanque', ranged: true, atkRange: 160,
    hp: 660, hpG: 105, mp: 320, mpG: 50, ad: 56, adG: 3.2, armor: 40, armorG: 4.2, mr: 32, mrG: 1.3,
    as: 0.6, asG: 0.012, ms: 104, hpRegen: 8.5, mpRegen: 8,
    passive: { name: 'Engrenagens Giratórias', desc: 'A cada 8s, gira as engrenagens causando dano aos próximos.', key: 'gears' },
    abilities: {
      Q: { name: 'Mola Tensionada', desc: 'Dispara uma engrenagem que quica entre inimigos.', cd: 9, mana: 55, range: 220, key: 'bouncycog' },
      W: { name: 'Sobrecarga', desc: 'Aumenta velocidade de ataque e movimento por 5s.', cd: 15, mana: 50, range: 0, key: 'overclock' },
      E: { name: 'Campo de Cronômetro', desc: 'Cria uma zona que deixa inimigos em câmera lenta.', cd: 18, mana: 70, range: 200, key: 'slowfield' },
      R: { name: 'Paradoxo Temporal', desc: 'Congela todos inimigos próximos no tempo por 1,5s.', cd: 110, mana: 100, range: 0, key: 'timestop' },
    },
    look: { skin: '#c8a860', hair: '#000000', armor: '#b89030', trim: '#e0c050', legs: '#8c6a26', weapon: 'fists', weaponColor: '#ffd040', robot: true, hairStyle: 'none' } as L,
  },
  // 4. MYRMIDON — Controlador de Enxames (Maga)
  {
    id: 'myrmidon', name: 'Myrmidon', title: 'A Voz do Enxame', role: 'Maga', ranged: true, atkRange: 170,
    hp: 530, hpG: 80, mp: 380, mpG: 58, ad: 52, adG: 3, armor: 22, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.63, asG: 0.014, ms: 104, hpRegen: 5.5, mpRegen: 9,
    passive: { name: 'Praga Crescente', desc: 'Habilidades infectam alvos; infectados sofrem dano extra.', key: 'swarmplague' },
    abilities: {
      Q: { name: 'Nuvem de Insetos', desc: 'Invoca uma nuvem de insetos que causa dano contínuo.', cd: 6, mana: 50, range: 200, key: 'bugcloud' },
      W: { name: 'Casca de Quitina', desc: 'Ganha um escudo de insetos que absorve dano.', cd: 13, mana: 55, range: 0, key: 'chitinshield' },
      E: { name: 'Feromônio de Caça', desc: 'Marca um alvo; insetos causam dano extra contra ele.', cd: 11, mana: 60, range: 220, key: 'pheromone' },
      R: { name: 'Devorador de Enxame', desc: 'Libera um enxame gigante que devora tudo em uma área.', cd: 90, mana: 100, range: 220, key: 'devourswarm' },
    },
    look: { skin: '#7a8a4a', hair: '#3a4a1a', armor: '#5a6a2a', trim: '#a0c050', legs: '#2a3a1a', weapon: 'staff', weaponColor: '#80a030', hood: true, hairStyle: 'none' } as L,
  },
  // 5. NOCTARA — Tecelã de Sonhos (Assassina)
  {
    id: 'noctara', name: 'Noctara', title: 'A Tecelã de Pesadelos', role: 'Assassina', ranged: false, atkRange: 55,
    hp: 560, hpG: 88, mp: 260, mpG: 40, ad: 62, adG: 3.6, armor: 30, armorG: 3.4, mr: 32, mrG: 1.3,
    as: 0.68, asG: 0.028, ms: 112, hpRegen: 7, mpRegen: 6.5,
    passive: { name: 'Ecos Oníricos', desc: 'Após usar uma habilidade, o próximo ataque causa dano bônus.', key: 'dreamecho' },
    abilities: {
      Q: { name: 'Garra de Sombra', desc: 'Teleporta atrás do alvo e ataca causando dano mágico.', cd: 8, mana: 50, range: 200, key: 'shadowpounce' },
      W: { name: 'Névoa de Sono', desc: 'Cria uma nuvem que torna invisível por 3s.', cd: 16, mana: 60, range: 0, key: 'sleepmist' },
      E: { name: 'Pesadelo', desc: 'Infunde medo no alvo, fazendo-o fugir por 1,2s.', cd: 13, mana: 55, range: 180, key: 'nightmare' },
      R: { name: 'Marcha dos Pesadelos', desc: 'Cria uma onda de pesadelos que atordoa todos ao redor.', cd: 85, mana: 100, range: 0, key: 'nightmarch' },
    },
    look: { skin: '#b898d8', hair: '#3a1a4a', armor: '#4a2a5a', trim: '#c080ff', legs: '#2a1a3a', weapon: 'daggers', weaponColor: '#a060ff', cape: '#3a1a4a', hairStyle: 'long' } as L,
  },
  // 6. KRAGMAR — Kraken/Crab (Tanque aquático)
  {
    id: 'kragmar', name: 'Kragmar', title: 'A Fúria das Profundezas', role: 'Tanque', ranged: false, atkRange: 60,
    hp: 680, hpG: 108, mp: 280, mpG: 42, ad: 58, adG: 3.4, armor: 41, armorG: 4.3, mr: 32, mrG: 1.3,
    as: 0.62, asG: 0.016, ms: 103, hpRegen: 9, mpRegen: 7,
    passive: { name: 'Casca Abissal', desc: 'Recebe dano reduzido quando está com pouca vida.', key: 'abyssalshell' },
    abilities: {
      Q: { name: 'Garra Esmagadora', desc: 'Esmaga com a garra, causando dano e desacelerando.', cd: 9, mana: 55, range: 0, key: 'crabclaw' },
      W: { name: 'Concha Resistente', desc: 'Recolhe-se na concha, reduzindo dano por 3s.', cd: 15, mana: 50, range: 0, key: 'shellfortress' },
      E: { name: 'Jato de Água', desc: 'Dispara um jato de água pressurizada que empurra.', cd: 12, mana: 60, range: 220, key: 'waterjet' },
      R: { name: 'Abraço do Kraken', desc: 'Tenta agarrar todos os inimigos próximos e os esmaga.', cd: 105, mana: 100, range: 0, key: 'krakengrip' },
    },
    look: { skin: '#8a5a8a', hair: '#3a2a4a', armor: '#5a3a6a', trim: '#c080ff', legs: '#3a2a4a', weapon: 'fists', weaponColor: '#a060c0', furry: true, hairStyle: 'spike' } as L,
  },
  // 7. SOLANIS — Sacerdotisa do Sol (Suporte)
  {
    id: 'solanis', name: 'Solanis', title: 'A Luz da Alvorada', role: 'Suporte', ranged: true, atkRange: 165,
    hp: 550, hpG: 86, mp: 360, mpG: 55, ad: 50, adG: 2.9, armor: 24, armorG: 3.5, mr: 30, mrG: 0.5,
    as: 0.6, asG: 0.015, ms: 104, hpRegen: 6, mpRegen: 9,
    passive: { name: 'Bênção Solar', desc: 'Curas em aliados também concedem escudo por 2s.', key: 'sunblessing' },
    abilities: {
      Q: { name: 'Raio do Alvorecer', desc: 'Dispara um raio de luz que cura aliados e fere inimigos.', cd: 7, mana: 55, range: 220, key: 'dawnpierce' },
      W: { name: 'Aura Radiante', desc: 'Cura aliados próximos continuamente por 4s.', cd: 14, mana: 65, range: 0, key: 'radiantaura' },
      E: { name: 'Escudo de Luz', desc: 'Protege um aliado com um escudo brilhante.', cd: 12, mana: 55, range: 200, key: 'lightward' },
      R: { name: 'Apoio Solar', desc: 'Cura massiva em toda a equipe aliada próxima.', cd: 90, mana: 100, range: 0, key: 'sunrevival' },
    },
    look: { skin: '#f0d8a0', hair: '#ffe080', armor: '#f0c040', trim: '#ffffff', legs: '#c89020', weapon: 'staff', weaponColor: '#ffe080', hairStyle: 'long' } as L,
  },
  // 8. UMBRATH — Manipulador de Sombras (Mago)
  {
    id: 'umbrath', name: 'Umbrath', title: 'O Marionetista das Sombras', role: 'Maga', ranged: true, atkRange: 175,
    hp: 520, hpG: 78, mp: 400, mpG: 60, ad: 50, adG: 2.8, armor: 21, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.013, ms: 104, hpRegen: 5.5, mpRegen: 9.5,
    passive: { name: 'Fios de Sombra', desc: 'Ataques básicos criam fios que reduzem a velocidade do alvo.', key: 'shadowstrings' },
    abilities: {
      Q: { name: 'Marionete', desc: 'Lança um fio que prende e puxa o alvo em sua direção.', cd: 13, mana: 65, range: 240, key: 'puppetpull' },
      W: { name: 'Dança das Sombras', desc: 'Cria cópias de sombra que atacam inimigos próximos.', cd: 15, mana: 70, range: 0, key: 'shadowdance' },
      E: { name: 'Maldição de Linho', desc: 'Amaldiçoa uma área, impedindo que inimigos saiam.', cd: 17, mana: 60, range: 200, key: 'cursefield' },
      R: { name: 'Teatro dos Horrores', desc: 'Transforma inimigos em marionetes indefesas por 2s.', cd: 110, mana: 100, range: 0, key: 'puppetshow' },
    },
    look: { skin: '#9a8aaa', hair: '#1a1a2a', armor: '#2a2a3a', trim: '#8a8aaa', legs: '#181828', weapon: 'staff', weaponColor: '#5a5a7a', cape: '#1a1a2a', hairStyle: 'long' } as L,
  },
  // 9. THORNVEIL — Briar vivo (Lutador natureza)
  {
    id: 'thornveil', name: 'Thornveil', title: 'A Selva Viva', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 620, hpG: 94, mp: 300, mpG: 45, ad: 62, adG: 3.8, armor: 34, armorG: 3.8, mr: 32, mrG: 1.3,
    as: 0.64, asG: 0.02, ms: 107, hpRegen: 9, mpRegen: 7,
    passive: { name: 'Fotossíntese', desc: 'Fora de combate, regenera vida rapidamente.', key: 'photosynth' },
    abilities: {
      Q: { name: 'Chicote de Espinhos', desc: 'Estende espinhos que causam dano e sangramento.', cd: 8, mana: 50, range: 180, key: 'thornwhip' },
      W: { name: 'Armadilha de Raízes', desc: 'Cria raízes que prendem inimigos em uma área.', cd: 14, mana: 60, range: 180, key: 'roottrap' },
      E: { name: 'Broto Explosivo', desc: 'Planta uma semente que explode após um atraso.', cd: 11, mana: 55, range: 160, key: 'seedbomb' },
      R: { name: 'Fúria da Floresta', desc: 'Invoca trentos que atacam inimigos por 10s.', cd: 100, mana: 100, range: 0, key: 'forestwrath' },
    },
    look: { skin: '#6a8a4a', hair: '#3a5a1a', armor: '#4a6a2a', trim: '#8ac050', legs: '#3a5a1a', weapon: 'fists', weaponColor: '#5a8a30', furry: true, hairStyle: 'spike' } as L,
  },
  // 10. GLIMMERFIN — Peixe-lanterna abissal (Atiradora)
  {
    id: 'glimmerfin', name: 'Glimmerfin', title: 'A Luz das Profundezas', role: 'Atiradora', ranged: true, atkRange: 185,
    hp: 530, hpG: 82, mp: 280, mpG: 38, ad: 58, adG: 3.4, armor: 22, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.66, asG: 0.031, ms: 110, hpRegen: 5, mpRegen: 7,
    passive: { name: 'Bio-Luminescência', desc: 'Ataques deixam brilho que revela e causa dano extra.', key: 'bioluminescence' },
    abilities: {
      Q: { name: 'Feixe Bioluminescente', desc: 'Dispara um feixe de luz que revela e fere.', cd: 8, mana: 50, range: 250, key: 'biobeam' },
      W: { name: 'Tinta Negra', desc: 'Solta tinta que cega e desacelera inimigos.', cd: 13, mana: 55, range: 0, key: 'inkcloud' },
      E: { name: 'Choque Elétrico', desc: 'Libera uma descarga elétrica que atordoa o alvo.', cd: 14, mana: 60, range: 200, key: 'eshock' },
      R: { name: 'Vórtice Abissal', desc: 'Cria um redemoinho que puxa e causa dano massivo.', cd: 95, mana: 100, range: 250, key: 'abyssvortex' },
    },
    look: { skin: '#4a7a9a', hair: '#a0e0f0', armor: '#3a5a7a', trim: '#80e0ff', legs: '#2a4a6a', weapon: 'staff', weaponColor: '#60d0ff', furry: true, hairStyle: 'short' } as L,
  },
  // 11. IRONPEAK — Gigante da Montanha (Tanque)
  {
    id: 'ironpeak', name: 'Ironpeak', title: 'O Pico Inabalável', role: 'Tanque', ranged: false, atkRange: 60,
    hp: 700, hpG: 112, mp: 240, mpG: 38, ad: 60, adG: 3.5, armor: 44, armorG: 4.6, mr: 32, mrG: 1.3,
    as: 0.58, asG: 0.014, ms: 100, hpRegen: 9.5, mpRegen: 6.5,
    passive: { name: 'Pele de Granito', desc: 'Imune a empurrões; reduz a duração de atordoamentos.', key: 'graniteskin' },
    abilities: {
      Q: { name: 'Soco Sísmico', desc: 'Bate no chão causando dano em área.', cd: 9, mana: 55, range: 0, key: 'seismicfist' },
      W: { name: 'Parede de Pedra', desc: 'Cria uma barreira que bloqueia movimento inimigo.', cd: 18, mana: 60, range: 160, key: 'stonewall' },
      E: { name: 'Avalanche', desc: 'Rola uma pedra gigante que atropela inimigos.', cd: 13, mana: 60, range: 220, key: 'boulder' },
      R: { name: 'Fúria da Montanha', desc: 'Salta e aterraça, atordoando e causando dano massivo.', cd: 110, mana: 100, range: 0, key: 'mountainslam' },
    },
    look: { skin: '#9a8a7a', hair: '#5a4a3a', armor: '#6a5a4a', trim: '#c0a080', legs: '#4a3a2a', weapon: 'fists', weaponColor: '#8a7a6a', hairStyle: 'short' } as L,
  },
  // 12. VESPER — Bardo Sônico (Suporte)
  {
    id: 'vesper', name: 'Vesper', title: 'O Eco das Estrelas', role: 'Suporte', ranged: true, atkRange: 168,
    hp: 540, hpG: 84, mp: 350, mpG: 52, ad: 50, adG: 3, armor: 23, armorG: 3.4, mr: 30, mrG: 0.5,
    as: 0.6, asG: 0.014, ms: 105, hpRegen: 5.5, mpRegen: 9,
    passive: { name: 'Ressonância', desc: 'Habilidades que atingem aliados amplificam a cura seguinte.', key: 'resonance' },
    abilities: {
      Q: { name: 'Nota Aguda', desc: 'Dispara uma onda sonora que causa dano e silencia.', cd: 9, mana: 55, range: 230, key: 'sharpnote' },
      W: { name: 'Canção Curativa', desc: 'Canta uma melodia que cura aliados ao redor.', cd: 12, mana: 60, range: 0, key: 'healsong' },
      E: { name: 'Acelerando', desc: 'Aumenta velocidade de aliados próximos por 4s.', cd: 14, mana: 50, range: 0, key: 'crescendo_spd' },
      R: { name: 'Sinfonia Final', desc: 'Cria uma onda sonora massiva que empurra e atordoa.', cd: 95, mana: 100, range: 0, key: 'finalsymphony' },
    },
    look: { skin: '#e0c0e0', hair: '#c060c0', armor: '#5a3a6a', trim: '#e080e0', legs: '#3a2a4a', weapon: 'staff', weaponColor: '#e080e0', hairStyle: 'twin' } as L,
  },
  // 13. CINDERFOX — Raposa de fogo (Atiradora fera)
  {
    id: 'cinderfox', name: 'Cinderfox', title: 'A Chama Dançante', role: 'Atiradora', ranged: true, atkRange: 178,
    hp: 520, hpG: 80, mp: 280, mpG: 40, ad: 56, adG: 3.3, armor: 22, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.67, asG: 0.03, ms: 111, hpRegen: 5, mpRegen: 7,
    passive: { name: 'Pelo Flamejante', desc: 'Quando ataca, ganha velocidade de movimento.', key: 'firepelt' },
    abilities: {
      Q: { name: 'Bola de Fogo', desc: 'Lança uma bola de fogo que explode em área.', cd: 7, mana: 50, range: 230, key: 'fireorb' },
      W: { name: 'Passo de Chama', desc: 'Teleporta deixando um rastro de fogo.', cd: 13, mana: 55, range: 220, key: 'flamestep' },
      E: { name: 'Cauda Incandescente', desc: 'Gira causando dano de fogo ao redor.', cd: 10, mana: 55, range: 0, key: 'fietail' },
      R: { name: 'Espírito da Raposa', desc: 'Transforma-se em chamas, ganhando poder e velocidade.', cd: 90, mana: 100, range: 0, key: 'foxspirit' },
    },
    look: { skin: '#e07030', hair: '#c04020', armor: '#a04020', trim: '#ffc040', legs: '#8a2a10', weapon: 'fists', weaponColor: '#ff8040', furry: true, hairStyle: 'spike' } as L,
  },
  // 14. GALEN — Médico da Peste (Maga)
  {
    id: 'galen', name: 'Galen', title: 'O Medicante Sombrio', role: 'Maga', ranged: true, atkRange: 172,
    hp: 530, hpG: 82, mp: 370, mpG: 56, ad: 52, adG: 3, armor: 22, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.014, ms: 104, hpRegen: 5.5, mpRegen: 9,
    passive: { name: 'Imunidade Adquirida', desc: 'Curas que aplica reduzem o controle de grupo sofrido.', key: 'immunity' },
    abilities: {
      Q: { name: 'Frasco Tóxico', desc: 'Arremessa um frasco de veneno que causa dano em área.', cd: 8, mana: 50, range: 220, key: 'toxinflask' },
      W: { name: 'Injeção Curativa', desc: 'Injeta um aliado com soro que cura e dá escudo.', cd: 13, mana: 60, range: 200, key: 'serum' },
      E: { name: 'Nuvem Pestilenta', desc: 'Libera uma nuvem que envenena e desacelera.', cd: 12, mana: 60, range: 190, key: 'plaguecloud' },
      R: { name: 'Cura Milagrosa', desc: 'Cura totalmente um aliado e remove efeitos negativos.', cd: 100, mana: 100, range: 220, key: 'miraclecure' },
    },
    look: { skin: '#b8a898', hair: '#3a2a1a', armor: '#2a2a1a', trim: '#80a050', legs: '#1a1a0a', weapon: 'staff', weaponColor: '#608030', hood: true, hairStyle: 'none' } as L,
  },
  // 15. RIFTBORN — Ser Cósmico (Maga)
  {
    id: 'riftborn', name: 'Riftborn', title: 'A Entidade Entre Mundos', role: 'Maga', ranged: true, atkRange: 175,
    hp: 540, hpG: 84, mp: 420, mpG: 65, ad: 52, adG: 3, armor: 22, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.013, ms: 104, hpRegen: 6, mpRegen: 10,
    passive: { name: 'Energia Estelar', desc: 'Casting reduz o custo de mana da próxima habilidade.', key: 'stellarenergy' },
    abilities: {
      Q: { name: 'Buraco Negro', desc: 'Cria um singularidade que puxa e fere inimigos.', cd: 9, mana: 60, range: 220, key: 'blackhole' },
      W: { name: 'Dobra Espacial', desc: 'Teleporta a uma localização visível.', cd: 16, mana: 50, range: 250, key: 'spacefold' },
      E: { name: 'Novas', desc: 'Explosões estelares que causam dano mágico em área.', cd: 11, mana: 65, range: 210, key: 'supernova' },
      R: { name: 'Colapso da Realidade', desc: 'Cria um vórtice massivo que devasta a área por 5s.', cd: 100, mana: 100, range: 250, key: 'realitycollapse' },
    },
    look: { skin: '#6a4a9a', hair: '#a0c0ff', armor: '#3a2a6a', trim: '#c0a0ff', legs: '#2a1a4a', weapon: 'staff', weaponColor: '#a080ff', hairStyle: 'spike' } as L,
  },
  // 16. BOULDERBACK — Tartaruga blindada (Tanque)
  {
    id: 'boulderback', name: 'Boulderback', title: 'O Monumento Ambulante', role: 'Tanque', ranged: false, atkRange: 55,
    hp: 720, hpG: 115, mp: 260, mpG: 40, ad: 58, adG: 3.4, armor: 46, armorG: 4.8, mr: 34, mrG: 1.4,
    as: 0.58, asG: 0.012, ms: 98, hpRegen: 10, mpRegen: 6.5,
    passive: { name: 'Casco Milenar', desc: 'Bloqueia parte do dano recebido constantemente.', key: 'ancientshell' },
    abilities: {
      Q: { name: 'Investida Blindada', desc: 'Avança rolando, atropelando inimigos.', cd: 14, mana: 60, range: 0, key: 'shellroll' },
      W: { name: 'Recuo Defensivo', desc: 'Recolhe-se, reduzindo dano massivamente por 4s.', cd: 16, mana: 55, range: 0, key: 'turtletuck' },
      E: { name: 'Terremoto', desc: 'Bate no chão causando dano e lentidão.', cd: 11, mana: 55, range: 0, key: 'turtlequake' },
      R: { name: 'Bastião Eterno', desc: 'Torna-se uma fortaleza imóvel por 4s, imune a dano.', cd: 105, mana: 100, range: 0, key: 'eternalbastion' },
    },
    look: { skin: '#7a8a5a', hair: '#4a5a2a', armor: '#5a6a3a', trim: '#a0b060', legs: '#3a4a1a', weapon: 'fists', weaponColor: '#6a8a4a', furry: true, hairStyle: 'spike' } as L,
  },
  // 17. SHRIKE — Ave assassina (Assassina)
  {
    id: 'shrike', name: 'Shrike', title: 'O Bico Perfurante', role: 'Assassina', ranged: false, atkRange: 55,
    hp: 550, hpG: 86, mp: 240, mpG: 36, ad: 64, adG: 3.8, armor: 29, armorG: 3.4, mr: 32, mrG: 1.3,
    as: 0.69, asG: 0.029, ms: 114, hpRegen: 7, mpRegen: 6.5,
    passive: { name: 'Mergulho Predatório', desc: 'Ataques em inimigos feridos causam dano bônus.', key: 'predatordive' },
    abilities: {
      Q: { name: 'Bote Aéreo', desc: 'Mergulha no alvo causando dano e marcando.', cd: 8, mana: 50, range: 200, key: 'aerialstrike' },
      W: { name: 'Asas Cortantes', desc: 'Bate as asas, causando dano em leque.', cd: 9, mana: 55, range: 170, key: 'wingcut' },
      E: { name: 'Penas Afiadas', desc: 'Lança penas como lâminas perfurantes.', cd: 10, mana: 55, range: 220, key: 'featherblades' },
      R: { name: 'Tormenta de Garras', desc: 'Vira um redemoinho de garras por 3s, atingindo tudo.', cd: 80, mana: 100, range: 0, key: 'clawstorm' },
    },
    look: { skin: '#7a6a5a', hair: '#3a2a1a', armor: '#5a4a3a', trim: '#c0a070', legs: '#3a2a1a', weapon: 'daggers', weaponColor: '#d0c090', furry: true, hairStyle: 'spike' } as L,
  },
  // 18. MOSSHEART — Treante ancião (Tanque)
  {
    id: 'mossheart', name: 'Mossheart', title: 'O Ancião da Mata', role: 'Tanque', ranged: false, atkRange: 55,
    hp: 690, hpG: 110, mp: 300, mpG: 45, ad: 60, adG: 3.5, armor: 38, armorG: 4, mr: 34, mrG: 1.4,
    as: 0.6, asG: 0.015, ms: 100, hpRegen: 10, mpRegen: 7,
    passive: { name: 'Seiva Vital', desc: 'Ganha regeneração de vida que aumenta com o nível.', key: 'vitalsap' },
    abilities: {
      Q: { name: 'Punho de Tronco', desc: 'Golpeia com um braço de madeira pesado.', cd: 9, mana: 55, range: 0, key: 'trunkfist' },
      W: { name: 'Pele de Casca', desc: 'Reveste-se de casca, ganhando armadura e cura.', cd: 14, mana: 55, range: 0, key: 'barkskin' },
      E: { name: 'Esporos Curativos', desc: 'Libera esporos que curam aliados próximos.', cd: 13, mana: 60, range: 0, key: 'healingspores' },
      R: { name: 'Despertar da Mata', desc: 'Enraíza-se, criando trentos que defendem a área.', cd: 105, mana: 100, range: 0, key: 'forestawaken' },
    },
    look: { skin: '#6a5a3a', hair: '#4a5a2a', armor: '#5a4a2a', trim: '#8aa050', legs: '#3a2a1a', weapon: 'fists', weaponColor: '#6a5a2a', furry: true, hairStyle: 'spike' } as L,
  },
  // 19. VEXFIRE — Diabinho impulsivo (Atiradora)
  {
    id: 'vexfire', name: 'Vexfire', title: 'O Pequeno Infernal', role: 'Atiradora', ranged: true, atkRange: 180,
    hp: 520, hpG: 80, mp: 300, mpG: 45, ad: 58, adG: 3.4, armor: 21, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.67, asG: 0.03, ms: 113, hpRegen: 5, mpRegen: 7,
    passive: { name: 'Caucinante', desc: 'Conforme ataca, ganha velocidade de ataque.', key: 'caustic' },
    abilities: {
      Q: { name: 'Dardo de Enxofre', desc: 'Lança um dardo que queima e reduz cura.', cd: 7, mana: 45, range: 230, key: 'sulfurdart' },
      W: { name: 'Salto Diabólico', desc: 'Pula por cima de inimigos, deixando fogo.', cd: 12, mana: 50, range: 200, key: 'devilleap' },
      E: { name: 'Mini-Erupção', desc: 'Explode em fogo ao redor, causando dano.', cd: 10, mana: 55, range: 0, key: 'minieruption' },
      R: { name: 'Fúria Demoníaca', desc: 'Cresce e ganha poder de fogo massivo por 8s.', cd: 85, mana: 100, range: 0, key: 'demonfury' },
    },
    look: { skin: '#d04030', hair: '#3a0a0a', armor: '#8a2010', trim: '#ff6040', legs: '#5a1010', weapon: 'bow', weaponColor: '#ff8040', furry: true, hairStyle: 'spike' } as L,
  },
  // 20. TIDEWEAVER — Mágica da água (Maga)
  {
    id: 'tideweaver', name: 'Tideweaver', title: 'A Condutora das Marés', role: 'Maga', ranged: true, atkRange: 172,
    hp: 540, hpG: 82, mp: 380, mpG: 58, ad: 52, adG: 3, armor: 22, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.014, ms: 105, hpRegen: 5.5, mpRegen: 9.5,
    passive: { name: 'Fluxo das Marés', desc: 'Habilidades alternam entre cura e dano amplificado.', key: 'tidalflow' },
    abilities: {
      Q: { name: 'Lâmina de Água', desc: 'Dispara água pressurizada que corta.', cd: 7, mana: 50, range: 230, key: 'waterblade' },
      W: { name: 'Onda de Cura', desc: 'Cria uma onda que cura aliados no caminho.', cd: 13, mana: 60, range: 200, key: 'healwave' },
      E: { name: 'Prisão Líquida', desc: 'Envolve o alvo em água, prendendo-o.', cd: 14, mana: 60, range: 210, key: 'waterprison' },
      R: { name: 'Tsunami', desc: 'Invoca uma onda gigante que varre o campo de batalha.', cd: 95, mana: 100, range: 280, key: 'tsunami' },
    },
    look: { skin: '#a0d0e0', hair: '#4080a0', armor: '#3a7090', trim: '#80d0f0', legs: '#2a5070', weapon: 'staff', weaponColor: '#60c0e0', hairStyle: 'long' } as L,
  },
  // 21. GRIMFANG — Lobisomem (Lutador)
  {
    id: 'grimfang', name: 'Grimfang', title: 'O Predador da Lua Cheia', role: 'Lutador', ranged: false, atkRange: 55,
    hp: 630, hpG: 98, mp: 220, mpG: 32, ad: 66, adG: 4, armor: 32, armorG: 3.6, mr: 32, mrG: 1.3,
    as: 0.66, asG: 0.025, ms: 113, hpRegen: 8.5, mpRegen: 6.5,
    passive: { name: 'Sede de Sangue', desc: 'Causar dano cura uma parte do valor causado.', key: 'bloodthirst' },
    abilities: {
      Q: { name: 'Mordida Selvagem', desc: 'Avança e morde, curando-se com o dano.', cd: 8, mana: 50, range: 180, key: 'wildbite' },
      W: { name: 'Uivo de Guerra', desc: 'Aumenta velocidade de ataque e movimento.', cd: 14, mana: 45, range: 0, key: 'warhowl' },
      E: { name: 'Garra Dilacerante', desc: 'Golpeia em área causando sangramento.', cd: 10, mana: 55, range: 0, key: 'rendingclaw' },
      R: { name: 'Forma Lupina', desc: 'Transforma-se em lobo, ganhando poder e velocidade.', cd: 85, mana: 100, range: 0, key: 'wolfshape' },
    },
    look: { skin: '#8a8a98', hair: '#4a4a58', armor: '#4a3a5a', trim: '#b090d0', legs: '#2e1e40', weapon: 'fists', weaponColor: '#c0c0d0', furry: true, hairStyle: 'spike' } as L,
  },
  // 22. STARCALLER — Mago astral (Maga)
  {
    id: 'starcaller', name: 'Starcaller', title: 'O Convocador de Estrelas', role: 'Maga', ranged: true, atkRange: 178,
    hp: 520, hpG: 78, mp: 400, mpG: 62, ad: 50, adG: 2.8, armor: 21, armorG: 3, mr: 30, mrG: 0.5,
    as: 0.62, asG: 0.013, ms: 104, hpRegen: 5.5, mpRegen: 10,
    passive: { name: 'Constelação', desc: 'Ataques marcam o alvo; marcas explodem em dano.', key: 'constellation' },
    abilities: {
      Q: { name: 'Estrela Cadente', desc: 'Invoca uma estrela que cai causando dano em área.', cd: 7, mana: 55, range: 230, key: 'fallingstar' },
      W: { name: 'Pó Estelar', desc: 'Espalha poeira estelar que fere ao longo do tempo.', cd: 11, mana: 60, range: 200, key: 'stardust' },
      E: { name: 'Cometa', desc: 'Lança um cometa que perfura inimigos.', cd: 9, mana: 55, range: 240, key: 'comet' },
      R: { name: 'Chuva de Meteoros', desc: 'Faz chover meteoros em uma grande área.', cd: 90, mana: 100, range: 280, key: 'meteorshower' },
    },
    look: { skin: '#a0a0d0', hair: '#ffe0a0', armor: '#3a3a6a', trim: '#ffd080', legs: '#2a2a4a', weapon: 'staff', weaponColor: '#ffe080', hairStyle: 'long' } as L,
  },
  // 23. RUSTJAW — Catador tecnológico (Atiradora)
  {
    id: 'rustjaw', name: 'Rustjaw', title: 'O Catador de Sucata', role: 'Atiradora', ranged: true, atkRange: 188,
    hp: 540, hpG: 84, mp: 240, mpG: 35, ad: 60, adG: 3.5, armor: 24, armorG: 3.2, mr: 30, mrG: 0.5,
    as: 0.65, asG: 0.03, ms: 108, hpRegen: 5, mpRegen: 6.5,
    passive: { name: 'Reciclagem', desc: 'Abates restauram parte da mana e vida.', key: 'recycle' },
    abilities: {
      Q: { name: 'Disparo de Sucata', desc: 'Atira parafusos que perfuram armadura.', cd: 7, mana: 45, range: 240, key: 'scrapshot' },
      W: { name: 'Torreta Improvisada', desc: 'Monta uma torreta que atira inimigos.', cd: 16, mana: 60, range: 160, key: 'turret' },
      E: { name: 'Granada de Ferrugem', desc: 'Lança uma granada que explode em estilhaços.', cd: 11, mana: 55, range: 200, key: 'rustgrenade' },
      R: { name: 'Mega-Mecha', desc: 'Pilota um mecha gigante por 12s, ganhando poder.', cd: 95, mana: 100, range: 0, key: 'megamecha' },
    },
    look: { skin: '#c8a878', hair: '#5a4a3a', armor: '#8a6a3a', trim: '#c08040', legs: '#4a3a1a', weapon: 'bow', weaponColor: '#a07030', helmet: true, hairStyle: 'none' } as L,
  },
  // 24. FROSTBITE — Yeti de gelo (Tanque fera)
  {
    id: 'frostbite', name: 'Frostbite', title: 'O Terror Gelado', role: 'Tanque', ranged: false, atkRange: 55,
    hp: 680, hpG: 108, mp: 260, mpG: 40, ad: 62, adG: 3.6, armor: 40, armorG: 4.4, mr: 34, mrG: 1.4,
    as: 0.62, asG: 0.016, ms: 104, hpRegen: 9, mpRegen: 6.5,
    passive: { name: 'Abraço Gélido', desc: 'Inimigos próximos sofrem lentidão permanente.', key: 'icyembrace' },
    abilities: {
      Q: { name: 'Soco Congelante', desc: 'Golpeia congelando o alvo por um instante.', cd: 9, mana: 55, range: 0, key: 'frosthit' },
      W: { name: 'Pele de Gelo', desc: 'Cobre-se de gelo, ganhando armadura.', cd: 15, mana: 50, range: 0, key: 'iceskin' },
      E: { name: 'Sopro Gelado', desc: 'Sopra uma rajada de frio que causa dano e lentidão.', cd: 12, mana: 60, range: 180, key: 'frosthbreath' },
      R: { name: 'Avalanche Yeti', desc: 'Arremessa uma bola de neve gigante que atropela.', cd: 100, mana: 100, range: 240, key: 'yetivalanche' },
    },
    look: { skin: '#c0d0e0', hair: '#6080a0', armor: '#90b0c8', trim: '#e0f0ff', legs: '#5070a0', weapon: 'fists', weaponColor: '#a0c0e0', furry: true, hairStyle: 'spike' } as L,
  },
  // 25. LUMEN — Construto de luz (Suporte robot)
  {
    id: 'lumen', name: 'Lumen', title: 'O Guardião Cristalino', role: 'Suporte', ranged: true, atkRange: 168,
    hp: 560, hpG: 88, mp: 340, mpG: 52, ad: 50, adG: 3, armor: 28, armorG: 3.8, mr: 32, mrG: 1.3,
    as: 0.6, asG: 0.014, ms: 104, hpRegen: 6.5, mpRegen: 8.5,
    passive: { name: 'Prisma', desc: 'Dano mágico sofrido é parcialmente refletido.', key: 'prism' },
    abilities: {
      Q: { name: 'Raio Prismático', desc: 'Dispara um raio que reflete em inimigos.', cd: 8, mana: 55, range: 230, key: 'prismbeam' },
      W: { name: 'Cristal Protetor', desc: 'Cria um cristal que bloqueia projéteis.', cd: 16, mana: 60, range: 0, key: 'crystalward' },
      E: { name: 'Fragmentos Luminosos', desc: 'Espalha cristais que curam aliados que passam.', cd: 12, mana: 55, range: 180, key: 'lightfragments' },
      R: { name: 'Santuário de Luz', desc: 'Cria um campo de luz que cura aliados por 5s.', cd: 95, mana: 100, range: 0, key: 'lightsanctuary' },
    },
    look: { skin: '#f0e8d0', hair: '#000000', armor: '#e0c8a0', trim: '#ffe080', legs: '#c8a878', weapon: 'staff', weaponColor: '#ffe080', robot: true, hairStyle: 'none' } as L,
  },
];

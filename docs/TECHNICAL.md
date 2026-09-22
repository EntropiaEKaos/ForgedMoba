# 🎮 Pixel Rift — Documentação Técnica

MOBA Cartoon 5v5 super expressivo com **47 heróis jogáveis**, 40+ itens com receitas, sistema de feitiços e runas pré-partida, wards e Fog of War dinâmica, e mecânicas lendárias de Dota (Buyback, Deny de minions e Runas do Rio). O projeto conta com persistência de dados local (carreira, maestria, histórico de 50 partidas, skins), console administrativo embutido (Ctrl+Shift+M) e suporte online (JWT + Socket.io) com fallback offline inteligente.

## Arquitetura Atual

```text
src/App.tsx                  fluxo de telas, HUD, loja e partida
src/admin/types.ts           contratos de modos e mapas
src/admin/content.ts         persistencia e sincronizacao de conteudo
src/admin/AdminPanel.tsx     CRUD administrativo
src/game/engine.ts           simulacao, IA, combate, input e render
src/game/heroes*.ts          heróis base e originais
src/game/items.ts            itens e receitas
src/game/map.ts              topologia, rotas, camps e walk grid
src/game/sprites.ts          sprites procedurais
src/game/skins.ts            catalogo de skins
src/screens/                 conexao e draft
src/network/                 sessao e matchmaking
```

O Canvas e o motor controlam o estado por frame. React controla telas, paineis e o HUD por snapshots reduzidos.

## Camada Visual (Refatoração Completa)

A renderização é organizada em camadas empilhadas na ordem correta:

1. **Terreno pré-renderizado** (`ground` em canvas offscreen com zoom aplicado).
2. **Partículas ambiente** (`drawAmbient`): ~90 vagalumes flutuando na selva e ~40 cintilações ao longo do rio, com movimento lissajous determinístico (sem estado por frame) e brilho aditivo. Respeitam a névoa de guerra.
3. **Fog of War** com memória de terreno.
4. **Pulso das fontes**: glow radial pulsante (azul/vermelho) nas duas bases.
5. **Zonas, unidades, wards, runas do rio, projéteis e FX**.
6. **Indicador de mira, efeitos de tela e minimapa**.

### Feedback de combate

- **Barra de dano fantasma**: todo dano registra `ghostHp/ghostT` na unidade; a barra de vida exibe um rastro vermelho que encolhe em ~0,7s atrás da vida atual.
- **Auras de buff no mundo**: Sentinela Azul e Bruto Rubro orbitam com 3 motes; Dano Duplo (dd), Haste e Regeneração possuem órbitas próprias; Barão desenha um anel roxo pulsante sob os pés.
- **Estruturas vivas**: torres ganharam estandarte de time ondulando e rachaduras visíveis abaixo de 40% de vida.
- **Minimapa**: o jogador recebe um anel verde pulsante para localização instantânea.

## Game Loop

1. `requestAnimationFrame` calcula `dt` limitado.
2. `update(dt)` processa IA, movimento, buffs, cooldowns, projeteis, zonas e fog.
3. `render()` desenha terreno, fog, unidades, VFX e minimapa.
4. `snapshot()` publica o estado necessario ao HUD React.

## Conteudo Administrativo

`src/admin/content.ts` preserva uma copia do conteudo-base e aplica overrides serializados. Ao salvar:

- `HEROES` e `HERO_BY_ID` sao reconstruidos.
- `ITEMS` e `ITEM_BY_ID` sao reconstruidos.
- Modos e mapas permanecem versionados no armazenamento local.
- O modo ativo e carregado no construtor de uma nova partida.

Consulte `ADMIN.md`, `GAMEPLAY.md` e `EXTENDING.md`.

---

## 0. Changelog de Correções

### v0.5 — Animação Rica & Efeitos de Magia Aprimorados
- ✅ **Animação de personagens com 4 frames**: ciclo de caminhada suave (pernas, braços, balanço vertical), respiração no idle (com piscar de olhos), pose de ataque (recuo + golpe) e pose de conjuração (arma levantada com brilho)
- ✅ **Sistema de poses**: `idle` / `walk` / `attack` / `cast` detectadas automaticamente pelo estado da unidade (`castT`, `attackAnimT`)
- ✅ **Sprites com sombreamento**: bordas de luz/sombra na armadura, brilho no tridente/cajado durante conjuração
- ✅ **Efeitos de magia com brilho aditivo** (`globalCompositeOperation: lighter`): anéis com halo, feixes com núcleo branco, faíscas luminosas
- ✅ **Novos efeitos**: `explosion` (núcleo + gradiente + anel de choque), `shockwave`, `orb` (impacto pulsante), `lightning` (raio irregular), `nova` (raios radiais), `runes` (círculo mágico de ult), `heal` (cruzes subindo)
- ✅ **Projéteis com trilha alongada e halo radial**: skillshots deixam rastro luminoso
- ✅ **Cortes em arco** (`slash`) rotacionados na direção do golpe
- ✅ **Ultimates épicos**: explosões e ondas de choque em Tibbers, Static Field, Glacial Tremor; raios elétricos individuais no Static Field; círculo de runas ao conjurar qualquer ultimate
- ✅ **Morte com impacto**: explosão + onda de choque ao abater heróis

### v0.4 — Multi-Kills, Pings Táticos, Chat In-Game & Áudio 8-Bit
- ✅ **Double, Triple, Quadra, PENTAKILL & ACE**: Anunciador sonoro e visual épico para sequências de abates
- ✅ **Trilha Sonora Chiptune 8-Bit Procedural**: Música de batalha suave e dinâmica sintetizada no navegador
- ✅ **Pings Táticos (G / Alt / Botão 📍)**: ⚠️ Perigo, 🏃 A Caminho, ❓ Inimigo MIA, 🆘 Ajuda visíveis no mapa e minimapa
- ✅ **Chat In-Game com Bots**: Mensagens táticas da equipe, avisos de MIA e celebrações automáticas
- ✅ **Segmentos de 100 HP**: Ticks pretos clássicos nas barras de vida para facilitar a leitura de tanques vs frágeis
- ✅ **Sincronização Multi-Aba (P2P)**: Canal `BroadcastChannel` para sincronizar pings e chat entre abas do navegador

### v0.3 — Bug Fixes + 10 Heróis
- ✅ **Monstros da selva fora do campo**: leash rígido (220px) — monstros voltam imediatamente ao passar do limite, curam 50%/s enquanto voltam
- ✅ **Habilidades iniciando todas**: heróis agora começam com **Q=1, W/E/R=0** — devem ser upadas (Ctrl+QWER ou botão +)
- ✅ **Visão muito escura**: raio de visão aumentado (200→320 melee, 260→380 ranged, 320→450 torres), fog reduzido (0.82→0.68), gradientes suavizados
- ✅ **Junglers invadindo lanes**: novo `junglerAI` com rota fixa de acampamentos do próprio lado, smite automático, ganks oportunistas
- ✅ **Bots travados na base**: saída direta para o primeiro waypoint da rota (garantido caminhável), sem espera de 94% de vida
- ✅ **+10 heróis**: Jaina, Thresk, Jinxara, Yasuke, Zedric, Sonara, Garen, Malzahar, Nidalee, Akali, Braum (22 total)
- ✅ **Last-hit bonus**: +50% de ouro em minions mortos por herói
- ✅ **Bounty system**: ouro por abate escala com sequência de kills (300→1000), shutdown gold
- ✅ **Feitiços de invocador**: 8 tipos (Flash obrigatório), seleção pré-partida
- ✅ **Wards + Fog of War**: sistema de visão em grade, wards plantáveis, memória de terreno
- ✅ **Itens ativos**: Youmuu's, Randuin's, QSS, Ward (além de Zhonya)
- ✅ **Níveis de habilidade**: 1 ponto/nível (2 em 6/11/16), bônus de dano por nível
- ✅ **Persistência**: perfil de invocador, histórico de 50 partidas, ranks, stats por herói

---

## 1. Arquitetura Geral

```
src/
├── game/
│   ├── heroes.ts       → 12 heróis (stats, habilidades, passivas, aparência)
│   ├── items.ts        → 26 itens com receitas e passivas
│   ├── summoners.ts    → 8 feitiços de invocador (Flash obrigatório)
│   ├── map.ts          → Mapa 3000×3000, rotas, selva, grade de colisão
│   ├── wards.ts        → Fog of War + sistema de wards
│   ├── sprites.ts      → Sprites pixel-art gerados proceduralmente
│   ├── sound.ts        → SFX sintetizados via WebAudio
│   ├── persistence.ts  → Perfil + histórico de partidas (localStorage)
│   └── engine.ts       → Motor: loop, IA, física, render, rede
├── App.tsx             → UI React (seleção, HUD, loja, placar)
└── index.css           → Tema pixel + animações
```

### 1.1 Loop de Jogo (engine.ts)

```
requestAnimationFrame → update(dt) → render()
  ├── update(dt)
  │   ├── ondas de minions (a cada 30s)
  │   ├── fog.reset() + reveal(heróis, torres, wards)
  │   ├── wards expiram
  │   ├── cooldowns (summoner spells, ativos)
  │   ├── updateUnit() × N
  │   │   ├── buffs (DoTs, spins, meditate, lotus)
  │   │   ├── regen + ouro passivo + XP
  │   │   ├── recall, sunfire, banshee, camouflage
  │   │   ├── towerAI / minionAI / monsterAI / botAI / junglerAI
  │   │   └── heroMotion (movimento com anti-stuck)
  │   ├── separação suave entre unidades
  │   ├── updateProjectiles()
  │   └── updateZones()
  └── render()
      ├── chão (canvas pré-renderizado)
      ├── fog of war
      ├── zonas, projéteis, unidades (ordenados por Y)
      ├── efeitos (sparks, slashes, beams, lasers, banners)
      └── minimapa
```

### 1.2 Sistema de Coordenadas

- **Mundo**: 3000×3000 unidades.
- **Câmera**: segue o jogador (modo Y trava, espaço centraliza).
- **Colisão**: grade 60×60 (50px/célula). `isWalkable(x,y)` consulta `Uint8Array`.
- **Movimento**: `tryMove()` tenta o destino; se falhar, desliza na perpendicular; se ainda travar, `nearestWalkable()` reposiciona.

---

## 2. Heróis e Habilidades

**22 heróis no total** (12 iniciais + 10 extras):

### Heróis Iniciais (12)
| ID | Nome | Título | Role |
|----|------|--------|------|
| gareth | Gareth | O Poder de Demacia | Lutador |
| anya | Anya | A Criança Sombria | Maga |
| ashka | Ashka | A Arqueira do Gelo | Atiradora |
| yamir | Yamir | O Espadachim Wuju | Assassino |
| rizar | Rizar | O Mago Rúnico | Maga |
| timo | Timo | O Explorador Veloz | Atirador |
| luxana | Luxana | A Dama Luminosa | Maga |
| darion | Darion | A Mão de Noxus | Lutador |
| katya | Katya | A Adaga Sinistra | Assassina |
| blitz | Blitz | O Golem a Vapor | Tanque |
| warrik | Warrik | O Lobo de Zaun | Lutador |
| morgause | Morgause | A Anja Caída | Suporte |

### Heróis Extras (10)
| ID | Nome | Título | Role |
|----|------|--------|------|
| jaina | Jaina | A Feiticeira do Gelo | Maga |
| thresk | Thresk | O Guardião das Correntes | Suporte |
| jinxara | Jinxara | A Atiradora da Caçada | Atiradora |
| yasuke | Yasuke | O Espadachim Errante | Assassino |
| zedric | Zedric | O Mestre das Sombras | Assassino |
| sonara | Sonara | A Búfola da Tempestade | Maga |
| garen | Garen | O Poder de Demacia | Lutador |
| malzahar | Malzahar | O Profeta do Vazio | Maga |
| nidalee | Nidalee | A Caçadora Bestial | Atiradora |
| akali | Akali | A Punho de Ferro | Assassina |
| braum | Braum | O Coração de Freljord | Tanque |

Cada herói tem:
- **Stats base + crescimento por nível** (`hpG`, `adG`, `asG`, etc.)
- **4 habilidades** (Q/W/E/R) com `cd`, `mana`, `range`, `key`
- **Passiva** com `key` que o motor reconhece
- **Aparência** (`look`) para o gerador de sprites
- **Habilidades começam com Q=1** (escolha inicial), W/E/R em 0 — devem ser upadas

### 2.1 Passivas Implementadas

| Herói | Passiva | Efeito |
|-------|---------|--------|
| Gareth | Perseverança | Regen 1,5%/s fora de combate |
| Anya | Piromania | A cada 4 feitiços, próximo atordoa |
| Ashka | Foco Gélido | Ataques congelam (slow 20%) |
| Yamir | Golpe Duplo | A cada 4 ataques, acerta 2x |
| Rizar | Maestria Arcana | Conjurar reduz CD das outras |
| Timo | Camuflagem | Invisível parado 2,5s |
| Luxana | Iluminação | Habilidades marcam; ataque detona |
| Darion | Hemorragia | Sangramento acumulável 5x |
| Katya | Voracidade | Abates reduzem todos os CDs |
| Blitz | Barreira de Mana | Escudo = 50% mana (90s CD) |
| Warrik | Fome Eterna | Ataques dão dano mágico + curam |
| Morgause | Sifão de Almas | Dano de habilidade cura 20% |

### 2.2 Níveis de Habilidade

- 1 ponto por nível (2 nos níveis 6, 11, 16)
- Q/W/E: máx 5 pontos · R: máx 3 pontos
- Bônus de dano: +10/nível (Q/W/E), +60/nível (R)
- **Controles**: `Ctrl+Q/W/E/R` ou botão `+` no HUD

---

## 3. Sistema de Combate

### 3.1 Dano
```
dano_final = dano_base × (100 / (100 + resistência))
            × (1 - damage_reduction_buffs)
            × (1 - ninjatabi_10% se ataque)
            - escudos
```
- **Penetração mágica**: `mr_efetivo = mr × (1 - mpen)`
- **Dano verdadeiro**: ignora armadura e MR
- **Crítico**: 200% (250% com Gume do Infinito)

### 3.2 Last-hit Bonus
- Minions mortos por herói: **+50% de ouro** (além do base)
- Apenas se o herói deu o golpe final (não minions aliados)

### 3.3 Bounty System
- Ouro base por abate: 300
- Aumenta com sequência de kills: `+50/kill` (máx 1000)
- Diminui com sequência de mortes: `-50/morte` (mín 300)
- **Shutdown**: abater alguém com 3+ kills seguidas → banner + ouro cheio

### 3.4 Controle de Grupo
- **Stun**: não move, não ataca, não conjura
- **Root**: não move, mas ataca/conjura
- **Slow**: reduz velocidade
- **Silence**: não conjura
- **Blind**: ataques erram
- **Fear**: foge do causador
- **Invuln** (Zhonya/Alpha): imune a tudo

---

## 4. Itens e Receitas

### 4.1 Estrutura
```typescript
interface ItemDef {
  id, name, totalCost, recipe: string[], stats, passive?, passiveKey?, tier
}
```
- **Tier 1**: componentes (Espada Longa, Adaga, Tomo, Rubi, etc.)
- **Tier 2**: intermediários (B.F. Sword, Cajado Desmedido, etc.)
- **Tier 3**: lendários (Gume do Infinito, Rabadan, Zhonya, etc.)

### 4.2 Itens Ativos
| Item | Efeito | CD |
|------|--------|-----|
| Zhonya | Invulnerável 2s | 90s |
| Youmuu's | +25% vel. movimento/ataque 6s | 60s |
| Randuin's | Slow 40% em área 2s | 60s |
| QSS | Remove CCs | 90s |
| Ward | Planta ward reveladora | 30s |

### 4.3 Receitas
- `componentDiscount(id, owned)` calcula custo líquido (componentes possuídos são consumidos)
- Venda: 70% do valor total

---

## 5. Feitiços de Invocador

| Feitiço | CD | Efeito |
|---------|-----|--------|
| **Flash** (obrigatório) | 180s | Teleporta 200px |
| Ignite | 150s | Dano verdadeiro + Grevious Wounds |
| Heal | 180s | Cura aliado + self |
| Smite | 60s | 500 dano verdadeiro em monstro |
| Exhaust | 180s | Reduz dano e velocidade |
| Teleport | 240s | Canaliza até aliado/torre/ward |
| Barrier | 150s | Escudo absorvente |
| Clarity | 180s | Restaura 40% mana em área |

**Controles**: `D` (slot 0), `F` (slot 1)

---

## 6. Mapa e Estruturas

### 6.1 Layout (igual ao Summoner's Rift)
- **Base azul**: canto inferior-esquerdo · **Base vermelha**: canto superior-direito
- **Rotas**: Topo (bordas), Meio (diagonal), Bot (bordas)
- **Rio**: perpendicular ao meio, com poços do Barão (topo) e Dragão (base)

### 6.2 Estruturas
- **Torres**: 11 por time (3 por rota + 2 do Nexus)
  - Regra de invulnerabilidade: só atacável após a anterior cair
- **Inibidores**: 3 por time · destruídos geram superminions por 240s
- **Nexus**: 1 por time · só atacável sem torres do Nexus
- **Fonte**: laser 900 dano/s em inimigos a 260px

### 6.3 Selva
- 6 acampamentos por lado (Gromp, Buff Azul, Lobos, Raptors, Buff Vermelho, Krugs)
- Buffs: Azul (mana/CDR), Vermelho (queimadura/slow)
- Dragão (150s respawn) e Barão (240s respawn) com buff global

---

## 7. Fog of War e Wards

### 7.1 Sistema de Visão
- Grade 80×80px, `Uint8Array` com bits por time
- `fog.reveal(x, y, r, team)` marca células visíveis
- `fog.isVisible(x, y, team)` para culling de render
- `fog.seen` (memória): áreas já vistas aparecem em cinza

### 7.2 Wards
- **Ward normal**: 120s, revela 220px
- **Sentry ward**: 180s, revela wards inimigas
- Plantável via item Ward (75 ouro) ou habilidades

### 7.3 Renderização
- Camada escura (`rgba(4,8,14,0.82)`) sobre o mapa
- `destination-out` com gradientes radiais cria buracos de visão
- Unidades inimigas fora da visão não são renderizadas

---

## 8. Inteligência Artificial

### 8.1 Bot de Lane
1. **Saída da base**: vai direto para o primeiro waypoint da rota (caminhável)
2. **Farming**: ataca minion mais próximo em alcance
3. **Push**: segue waypoints da rota
4. **Luta**: usa habilidades em heróis inimigos (prioridade: mais ferido)
5. **Recuo**: volta à base se HP < 24%
6. **Build**: compra itens pré-definidos por herói

### 8.2 Jungler
- 5º herói de cada time é marcado `isJungler = true`
- Rota: Gromp → Buff Azul → Lobos → Raptors → Buff Vermelho → Krugs
- Usa Smite em monstros com < 500 HP
- Ganks: vai para a lane mais próxima com inimigo ferido
- **Não invade lanes**: só farmar acampamentos do próprio lado

### 8.3 Monstros da Selva
- Agressivos se atacados ou se herói entra no raio
- **Leash**: perdem o alvo → curam tudo e voltam pro acampamento
- Não saem a mais de 420px do ponto inicial

---

## 9. Persistência

### 9.1 Perfil (localStorage)
```typescript
interface Profile {
  name, level, xp, wins, losses, kills, deaths, assists,
  cs, gold, timePlayed, mainHero, heroStats, favoriteSummoners,
  totalMatches, createdAt
}
```
- **Ranks**: Ferro → Bronze → Prata → Ouro → Platina → Diamante → Mestre → Desafiante
- **XP por partida**: 200 + kills×10 (vitória) / 80 + kills×5 (derrota)
- **Nível de conta**: 200 XP × nível_atual

### 9.2 Histórico de Partidas
- Últimas 50 partidas em `localStorage`
- Cada registro: herói, resultado, KDA, CS, ouro, tempo, abates por time
- **Stats por herói**: jogos, vitórias, KDA acumulado

---

## 10. Online e Multiplayer (Roadmap)

### 10.1 Arquitetura Atual
- Single-player: 1 jogador + 9 bots
- Estado 100% no cliente (`Game` class)
- Persistência local via `localStorage`

### 10.2 Próximos Passos

#### Fase 1: Ghost Replays (simula online)
- Salvar snapshots periódicos da partida
- "Assistir" partidas de outros jogadores (replays salvos)
- Leaderboard local

#### Fase 2: Peer-to-Peer (WebRTC)
- Sinalização via servidor leve (Node.js + Socket.IO)
- Host autoritativo: um jogador roda o `Game`, outros recebem snapshots
- Latência compensada com interpolação
- NAT traversal com STUN/TURN

#### Fase 3: Servidor Dedicado
- Node.js + WebSocket para partidas autoritativas
- Estado do jogo no servidor, clientes só enviam input
- Anti-cheat: validação de movimento, cooldowns, ouro
- Matchmaking por rank/MMR
- Salas de chat e lobby

### 10.3 Estrutura de Rede (planejada)
```typescript
// Cliente envia
interface ClientPacket {
  type: 'move' | 'attack' | 'cast' | 'summoner' | 'upgrade' | 'buy';
  data: any;
  seq: number;
}

// Servidor broadcasta
interface ServerSnapshot {
  t: number;
  units: { id, x, y, hp, mp, cds, buffs }[];
  projs: {...}[];
  fx: {...}[];
  result: 'win' | 'lose' | null;
}
```

---

## 11. Performance

- **Sprites**: gerados uma vez, cacheados em `Map<string, HTMLCanvasElement>`
- **Chão**: pré-renderizado em canvas 500×500, redimensionado
- **Fog of War**: offscreen canvas + `destination-out`
- **Culling**: unidades fora da tela ou fora da visão não são renderizadas
- **Snapshot p/ HUD**: a cada 120ms (não por frame)
- **Separação de unidades**: O(n²) mas só entre tipos diferentes (minion↔minion, hero↔minion)

---

## 12. Controles

| Tecla | Ação |
|-------|------|
| Botão Direito | Mover / Atacar alvo |
| Q W E R | Conjurar habilidades |
| Ctrl + Q/W/E/R | Upar habilidade |
| D F | Feitiços de invocador |
| A + Dir | Mover-atacando |
| S | Parar |
| B | Recall (voltar à base) |
| P | Loja (na base) |
| 1-6 | Ativo de item |
| Tab | Placar |
| H | Ajuda |
| Y | Travar câmera |
| Espaço | Centralizar câmera |
| M | Mudo |
| Esc | Fechar loja |

---

## 13. Build e Deploy

```bash
npm install      # instala dependências
npm run dev      # desenvolvimento
npm run build    # build de produção (single-file HTML)
```

- **Vite** com plugin `singlefile` → gera `dist/index.html` autossuficiente
- **Sem assets externos**: tudo gerado proceduralmente (sprites, sons)
- Fontes: Google Fonts (Press Start 2P + VT323)

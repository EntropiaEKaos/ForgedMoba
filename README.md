# ⚔️ Pixel Rift — MOBA Cartoon 2D Épico (5v5)

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](#)
[![React](https://img.shields.io/badge/React-18.2-cyan.svg)](#)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6-lightgrey.svg)](#)

**Pixel Rift** é um MOBA 2D completo, super expressivo e de alto impacto visual, com estilo artístico inspirado nos traços grossos, cel-shading e cabeças gigantes de **Awesomenauts**, mecânicas consagradas de **League of Legends** (Summoner's Rift espelhado, T1/T2/T3, Dragão, Barão, Inibidores e Arbustos/Invisibilidade) e a profundidade de jogo de **Dota** (Deny de minions, Buyback e Runas de Poder periódicas no Rio).

> **ForgedMoba 3.0:** o multiplayer publica o catálogo completo de 48 heróis, 192 habilidades e 39 itens em um pacote com hash. Q/W/E/R, mana, dano, resistências, controles, cura, escudo, receitas e economia são resolvidos pelo servidor autoritativo; o PixiJS apresenta o elenco inteiro sem assumir autoridade de gameplay.

O projeto é construído em React, TypeScript e Tailwind CSS no cliente, compilando para um único arquivo estático de alta performance (`dist/index.html`), e conta com um servidor Node.js/Express/Socket.io na pasta `/server` para suportar contas, JWT, salas e matchmaking online de forma integrada!

---

## 🌟 Principais Recursos e Diferenciais

### 1. 🎭 Estilo de Arte Cartoon Exagerado (Awesomenauts Style)
- **Traços Chunky**: Contornos pretos grossos em dupla camada de pixel que dão destaque instantâneo aos personagens no mapa.
- **Cabeça Gigante (50%+ da altura)**: Rostos desproporcionais e super expressivos. Os olhos são gigantes, piscam no idle, as sobrancelhas se contraem no ataque e a boca abre em grito de batalha revelando os dentes e língua.
- **Animações Fluidas (8 frames)**: Ciclo completo de caminhada com balanço de capa, respiração sutil e poses exclusivas para `idle`, `walk`, `attack` e `cast`.
- **Squash & Stretch Extremo**: Personagens se contraem sob impactos de dano (`hurt`), alongam ao voar ou conjurar (`cast`) e esmagam horizontalmente para dar peso físico no impacto de um golpe (`attack`).

### 2. 🌌 Efeitos Visuais (VFX) Cinematográficos
- **Brilho Aditivo (`lighter` blend)**: Camadas de cor translúcida e núcleos brancos brilhantes que criam efeitos mágicos de alta fidelidade e saturação de cores.
- **Impacto Temático das Habilidades**: O engine escolhe o efeito visual de impacto automaticamente conforme a identidade da magia (fogo = explosão com brasas, gelo = estilhaços congelantes, eletricidade = raios e novas, lâminas = cortes sangrentos direcionais com respingos).
- **Ultimates Espetaculares**:
  - *Tibbers (Anya)*: Explosão massiva de duas camadas + onda de choque + 16 brasas voando + tela vermelha pulsante de impacto.
  - *Final Spark (Lux)*: Laser duplo (halo colorido + núcleo branco) + estrela de faíscas na origem + pontos de explosões ao longo de todo o feixe.
  - *Static Field (Blitz)*: Tempestade elétrica com novas concêntricas + 8 raios radiais que buscam inimigos.
  - *Guillotine (Darion)*: Machado gigante caindo + cortes de sangue com respingos realistas + hit-stop estendido.
- **Morte de Herói Dramática**: Uma alma translúcida (fantasma correspondente à equipe) sobe flutuando com rastros de partículas, enquanto uma onda de choque e explosão sacodem a tela do jogador.
- **Camada Viva de Ambiente**: Vagalumes dançam pela selva escura e cintilações prateadas pulsam ao longo do rio. As fontes das bases brilham com um pulso de cura em ritmo constante.
- **Barras de Dano Fantasma**: Todo dano deixa um rastro vermelho temporário na barra de vida do alvo, encolhendo em ~0,7s — feedback de combate nítido e profissional.
- **Auras de Buff no Mundo**: Buffs de selva (Azul, Vermelho, Dano Duplo, Haste, Regeneração) orbitam visualmente o herói; o Barão desenha um anel roxo pulsante sob os pés.
- **Estruturas Vivas**: Torres com estandartes de time ondulando ao vento e rachaduras visíveis quando abaixo de 40% de vida. O minimapa destaca o jogador com um anel pulsante.

### 3. 🛡️ Mecânicas Clássicas de Dota e Jogabilidade Fluida
- **Deny de Minions**: Quando um minion aliado fica com menos de 30% de HP, o jogador pode atacá-lo e abatê-lo (clique esquerdo ou tecla `A`). Isso nega 100% do ouro para o oponente e reduz a experiência obtida por eles em 50%!
- **Compra de Volta (Buyback)**: Se estiver morto, pague uma taxa de ouro (baseada no seu nível) para ressurgir imediatamente na fonte. Possui cooldown tático de 3 minutos.
- **Runas de Poder do Rio**: A cada 2 minutos, uma runa especial de poder surge no rio (Dano Duplo, Super Velocidade, Invisibilidade ou Regeneração de Vida/Mana). O buff de regeneração quebra instantaneamente se você sofrer dano nos últimos 3 segundos!

### 4. ⚙️ Console Administrativo Embutido (`Ctrl + Shift + M`)
- Painel administrativo persistente para os balanceadores e criadores de conteúdo do jogo.
- **Editor de Heróis**: Altere stats, skins, passiva e as 4 habilidades. Ajuste de forma precisa os multiplicadores de dano e escalonamento (AD, AP, Armadura, RM, HP Máximo) que se integram dinamicamente com os itens do inventário.
- **Editor de Itens**: Crie novos itens, defina preços, receitas por ID, stats e ícone de glyph.
- **Modos e Mapas**: Crie e persista presets de jogo, regras e tamanhos para expansão.

### 5. 🌐 Multiplayer autoritativo
- **Health Check**: O cliente verifica no boot se o servidor está online. Se estiver, libera o fluxo de Login/Registro reais com JWT; se não estiver, cai de forma limpa e graciosa para o modo local com bots (modo Convidado).
- **Lobby com Matchmaking**: Fila de espera interativa com posição na fila, tempo estimado de espera e barra de progresso.
- **Servidor a 30 Hz**: comandos validados, snapshots com hash, prediction/reconciliation, interpolação remota e reconnect controlado.
- **Filas reais**: Duel 1v1, Skirmish 3v3 e Ranked 5v5 com draft de dez jogadores.
- **Conteúdo compatível**: cliente e servidor precisam anunciar exatamente o mesmo `contentVersion`.

---

## 📂 Estrutura do Projeto

```text
├── docs/                      # Documentação de referência técnica e de design
│   ├── TECHNICAL.md           # Visão geral da arquitetura de software e loops
│   ├── GAMEPLAY.md            # Guia completo de controles, itens, selva e runas
│   ├── ADDING_CONTENT.md      # Manual de expansão (criar heróis, itens, mapas, VFX)
│   └── ADMIN.md               # Guia do console administrativo (Ctrl+Shift+M)
│
├── server/                    # Servidor backend Socket.io + JWT (Node.js + TS)
│   ├── src/index.ts           # Matchmaking, API de autenticação e salas
│   └── package.json
│
└── src/                       # Cliente React + Canvas 2D + Tailwind
    ├── admin/                 # CRUD de administração de conteúdo local
    ├── game/                  # Motor principal, física, colisão, render e pings
    │   ├── engine.ts          # Game loopautoritativo local, IA dos bots, buffs
    │   ├── map.ts             # Topologia, waypoints de rotas, selva e colisão
    │   ├── sprites.ts         # Desenho de sprites, cel-shading, squash/stretch, poses
    │   ├── runes.ts           # Módulo de Runas pré-partida (Keystones, stats)
    │   ├── events.ts          # Módulo de Eventos de Partida aleatórios
    │   └── sound.ts           # Sintetizador WebAudio (chiptune 8-bit e SFX)
    ├── screens/               # Conexão, Lobby, Draft e Partida
    └── App.tsx                # Entrada principal e HUD
```

---

## 🚀 Como Rodar o Jogo Localmente

### 1. Iniciar o Cliente (React + Vite)
```bash
# Na raiz do projeto:
npm install
npm run dev
```
O jogo estará rodando em `http://localhost:5173`. Por padrão, se o servidor não estiver no ar, ele iniciará no modo offline (Convidado vs Bots).

### 2. Iniciar o Servidor Online (Opcional - para recursos de rede)
```bash
# Em uma nova aba de terminal:
cd server
npm install
npm run dev
```
O servidor estará rodando em `http://localhost:3001`. O cliente detectará o servidor automaticamente, ativará o badge ● Online e liberará o matchmaking!

---

## ⌨️ Atalhos de Teclado no Jogo

| Atalho | Ação |
|---|---|
| **LMB (Clique Esquerdo)** | Ataca o alvo. No chão, faz **attack-move**. Na mira, confirma a habilidade. |
| **RMB (Clique Direito)** | Move o personagem para a posição. Cancela a mira de habilidade ativa. |
| **Q / W / E / R** | Entra em modo de mira para habilidades skillshot/AoE. |
| **Ctrl + Q/W/E/R** | Evolui o nível da habilidade correspondente (consome ponto de skill). |
| **Shift + Q/W/E/R** | Atalho alternativo para evoluir habilidade. |
| **D / F** | Conjura os Feitiços de Invocador escolhidos no saguão. |
| **B** | Inicia canalização do Recall (6s) para retornar à fonte. |
| **P** | Abre/fecha a loja de itens (necessário estar na base). |
| **1 - 6** | Dispara o ativo dos itens do inventário (Zhonya, Youmuu, QSS, Randuin, Ward). |
| **G / V** | Abre a roda de pings táticos de mapa (Perigo ⚠️, A caminho 🏃, MIA ❓, Ajuda 🆘). |
| **Tab** | Segure para ver o placar com KDA, CS, itens de todos e bounties. |
| **Espaço** | Centraliza a câmera no herói do jogador. |
| **Y** | Trava/destrava a câmera no jogador. |
| **M** | Liga ou desliga o áudio (música retro chiptune e efeitos sonoros). |
| **Ctrl + Shift + M** | Abre o console de administração em tempo real. |

---

## ⚖️ Licença e Contribuição

Contribuições para o Pixel Rift são extremamente bem-vindas! Sinta-se à vontade para abrir pull requests ou sugerir novos campeões, itens ou modos de jogo. Consulte a pasta `docs/` para entender como estender o engine diretamente pelo código.

*Pixel Rift é um projeto de código aberto sob licença MIT. Todos os sprites e efeitos sonoros são gerados proceduralmente e sintetizados nativamente no navegador.*

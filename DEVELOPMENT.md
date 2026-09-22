# 🚀 Pixel Rift — Roadmap & Progresso

## ✅ Fase 1: Core (Concluída)
- 22 heróis com Q/W/E/R + passivas
- 26 itens com receitas e ativos
- Mapa fiel ao Summoner's Rift (torres, inibidores, nexus, selva, dragão, barão)
- 9 bots com IA (lanes + jungle), 3 dificuldades
- Animações (4 frames, poses idle/walk/attack/cast)
- Efeitos visuais ricos (explosões, raios, ondas de choque, brilho aditivo)
- HUD completo + tela de resumo pós-partida

## ✅ Fase 2: Online (Concluída)
- **Servidor** funcional em `/server` (Node + Express + Socket.io, em memória)
- **Health check** com fallback offline gracioso
- **Auth real** (login/registro JWT) + modo Convidado
- **Tela de Conexão/Login** como ponto de entrada
- **Lobby de Multiplayer** com fila de matchmaking
- **Status online** reativo no menu
- **Logout / troca de conta** nas Configurações

### Como ativar o multiplayer
```bash
cd server
npm install
npm run dev          # http://localhost:3001
```
O cliente detecta o servidor e liga o modo online automaticamente.

## ✅ Fase 3: Persistência (Concluída)
- Perfil salvo no `localStorage` (estatísticas de carreira)
- Histórico de partidas (últimas 50)
- Maestria de heróis (jogos, winrate, KDA por herói)
- Sistema de rank (Ferro → Desafiante) baseado em nível/WR
- Reset de perfil nas Configurações
- Resumo pós-partida com XP ganho

## 📋 Fase 4: Polimento (Próximos passos)
- [ ] Sincronização de estado 5v5 determinística (rollback netcode)
- [ ] Lag compensation / client prediction
- [ ] Replay system (gravar e assistir partidas)
- [ ] Spectator mode
- [ ] Anti-cheat server-side
- [ ] Mais heróis e itens
- [ ] Modos de jogo (ARAM, Arena)

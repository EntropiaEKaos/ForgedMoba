# Pixel Rift - Como Adicionar Conteudo

## Pelo Painel Admin

Pressione `Ctrl + Shift + A`. O painel cria, edita, restaura e exclui heróis, itens, modos e mapas. Os dados ficam em `localStorage`, na chave `pixelrift_admin_content_v1`.

## Heróis

Um `HeroDef` exige identidade, status, crescimento, passiva, Q/W/E/R e aparencia. Use o editor para gerar um template funcional.

Para adicionar pelo codigo, edite `src/game/heroes.ts` ou `src/game/heroes-original.ts`.

### Habilidade dedicada

Em `src/game/engine.ts`, adicione um `case` para a `ability.key` no metodo `cast`. Reutilize:

- `abilityHit` para dano e feedback.
- `skillshot` para projeteis.
- `enemies` e `enemyHeroes` para alvos.
- `addBuff` para controle e buffs.
- `zones`, `projs`, `fx` e `delayed` para efeitos persistentes.

Sem um `case`, o fallback do motor ainda aplica dano, recarga, mana e VFX.

Adicione a key em `ABILITY_VFX` para escolher cor e tema: `fire`, `ice`, `shadow`, `holy`, `blade`, `shock`, `nature`, `buff` ou `burst`.

## Itens

Um `ItemDef` possui ID, nome, custo, tier, receita, status, passiva, `passiveKey` e icone. Receitas usam IDs de outros itens.

Para uma passiva real, trate a key em `applyHeroStats`, `dealDamage`, `onHitEffects`, `updateUnit` ou `useActive`.

## Modos

`GameModeDef` controla:

- `teamSize` (1 a 5).
- `startingGold`.
- `waveInterval`.
- `maxLevel`.
- `passiveGoldRate`.
- `respawnScale`.
- `mapId`.

O modo ativo e carregado ao iniciar uma nova partida.

## Mapas

O painel cria presets visuais sobre a geometria atual. Tema, ambiente e fog sao aplicados pelo renderer.

Para geometria nova, abstraia `WORLD`, `LANES`, `CAMPS`, `TOWERS` e `walkGrid` de `src/game/map.ts` para uma interface de mapa.

## Checklist

1. Use IDs unicos e minusculos.
2. Confirme que receitas apontam para itens existentes.
3. Use keys de habilidade unicas.
4. Teste selecao, draft, loja, bots e fim da partida.
5. Execute `npm run build`.

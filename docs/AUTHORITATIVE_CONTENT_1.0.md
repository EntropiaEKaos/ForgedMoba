# ForgedMoba — Authoritative Content & Pixi 3.0

## Resultado

O catálogo legado deixou de ser exclusivo do motor offline. O servidor agora publica e executa um pacote imutável `authority-1.0.0+<hash>` com:

- 48 heróis;
- 192 habilidades Q/W/E/R;
- 39 itens, tiers e receitas;
- vida, mana, AD, AP, armadura, resistência mágica, velocidade de ataque, crítico, regeneração e roubo de vida;
- runtimes determinísticos de alvo, linha, cone, área, self-cast e dash;
- slow, root, stun, silence, haste, escudo e redução de dano;
- dano físico, mágico e verdadeiro com mitigação autoritativa;
- composição de itens com desconto e consumo de componentes;
- jungle, objetivo épico, wards, economia, respawn e draft já certificados nas fases anteriores.

O conteúdo continua editável no catálogo-fonte, mas somente a cópia validada, clonada, congelada e ligada ao hash pode entrar em uma partida online.

## Fronteira de autoridade

O navegador envia somente intenção:

`move | attack | stop | cast(Q/W/E/R) | buy | place-ward`

O servidor decide alcance, alvo, custo de mana, cooldown, dano, mitigação, controle de grupo, cura, escudo, posição resultante, inventário e resultado. Prediction reutiliza a mesma função determinística e é descartável diante do snapshot do servidor.

## Migração visual PixiJS

O cliente Pixi agora cobre todo o catálogo:

- os atlas premium de Gareth e Luxana continuam sendo usados;
- heróis ainda sem atlas recebem uma silhueta procedural animada derivada da paleta e arma do conteúdo publicado;
- idle, movimento, ataque e cast funcionam também no fallback procedural;
- os quatro cooldowns acionam efeitos Pixi;
- VFX usam famílias blade, fire, frost, arcane, nature, shadow, light e tech;
- ultimates recebem burst, ring e shake ampliados;
- o HUD mostra as habilidades reais de cada herói, mana real e os 39 itens;
- a loja exibe tiers, receitas, desconto por componentes e rolagem para o catálogo completo;
- o Canvas fallback aceita o mesmo conjunto Q/W/E/R.

## Compatibilidade

A versão do estado subiu para `SimulationState v4`. Clientes e servidores incompatíveis são recusados pelo `contentVersion`; não existe fallback silencioso para regras antigas.

## Gates obrigatórios

Uma alteração de conteúdo ou gameplay só pode ser promovida quando passam:

1. validação de limites da simulação e da camada visual;
2. TypeScript estrito no cliente e servidor;
3. determinismo de 100.000 ticks;
4. execução de Q/W/E/R para todos os 48 heróis;
5. testes de conteúdo, economia, rede, Pixi e servidor;
6. build de produção;
7. carga autoritativa 5v5;
8. instalação limpa pelos lockfiles da raiz e do servidor.


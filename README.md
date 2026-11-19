# Operação Agro Vila — 30 Famílias · 1.525.000 m²

Jogo 3D em primeira pessoa (e modo Drone Aéreo) construído em **Three.js + Vite**, 100% procedural (texturas PBR em canvas, iluminação atmosférica, vegetação instanciada, construções em estágios e áudio WebAudio sintetizado).

## Cenário & Mecânica

- **Área Total:** `1.525.000 m²` (63 alqueires paulistas) em formato triangular.
- **Área Comum Limpa:** `25.000 m²` no centro — única clareira aberta no início do jogo, onde as **30 famílias** estão acampadas em barracas ao redor de fogueiras comunitárias.
- **30 Sítios Cercados:** `50.000 m²` (5 hectares) cada, todos cercados com mourões, arames e porteiras numeradas (`SÍTIO 01` a `SÍTIO 30`), cobertos por **mata nativa fechada** no início.
- **150 Moradores Autônomos:** 30 famílias brasileiras (maioria composta de 5 pessoas) que atravessam as porteiras, derrubam árvores da floresta, carregam toras nos ombros e constroem progressivamente:
  - **6 Obras da Agro Vila (Área Comum):** Serraria & Galpão, Poço & Caixa d'Água, Horta Comunitária, Escola, Posto de Saúde e Praça & Quadra.
  - **30 Moradias, Paióis e Lavouras (Sítios 01–30):** quando a casa de uma família fica pronta, ela desmonta sua barraca no acampamento e passa a viver e cultivar no seu sítio.

## Controles

| Ação | Tecla / Botão |
|---|---|
| Mover | `W` `A` `S` `D` |
| Correr | `Shift` |
| Pular / Subir (Drone) | `Espaço` |
| Agachar / Descer (Drone) | `Ctrl` / `Q` |
| Usar ferramenta | Clique esquerdo |
| Selecionar ferramenta | `1` Machado · `2` Martelo · `3` Enxada · `4` Rádio (Mutirão) |
| Alternar Drone Aéreo | `V` |
| Mapa Tático & Fichas | `M` |
| Velocidade da Simulação | `T` (`1x` / `3x` / `8x`) |
| Pausar & Configurações | `ESC` |

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

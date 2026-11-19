import './ui/styles.css';
import { EventBus } from './core/EventBus.js';
import { Settings } from './core/Settings.js';
import { Engine } from './core/Engine.js';
import { SkyLighting } from './core/SkyLighting.js';
import { Input } from './core/Input.js';
import { TextureLab } from './world/TextureLab.js';
import { World } from './world/World.js';
import { Forest } from './world/Forest.js';
import { Constructions } from './world/Constructions.js';
import { Simulation } from './ai/Simulation.js';
import { Particles } from './fx/Particles.js';
import { AudioEngine } from './fx/AudioEngine.js';
import { ViewModel } from './player/ViewModel.js';
import { Player } from './player/Player.js';
import { HUD } from './ui/HUD.js';
import { TacticalMap } from './ui/TacticalMap.js';
import { Menu } from './ui/Menu.js';

function boot() {
  const canvasHost = document.getElementById('game-canvas-host');
  const hudRoot = document.getElementById('hud-root');
  const menuRoot = document.getElementById('menu-root');
  const tmapRoot = document.getElementById('tmap-root');

  const bus = new EventBus();
  const settings = new Settings(bus);
  const engine = new Engine(canvasHost, settings, bus);
  const sky = new SkyLighting(engine.scene, settings, bus);
  const input = new Input(engine.renderer.domElement, bus);

  // Texturas PBR procedurais
  const textures = new TextureLab(settings.preset.textureSize);

  // Mundo, floresta de 1.525.000 m² e obras progressivas
  const world = new World(engine.scene, textures, bus);
  const forest = new Forest(engine.scene, textures, settings, bus);
  const constructions = new Constructions(engine.scene, textures, bus);

  // Simulação das 30 famílias (150 moradores)
  const simulation = new Simulation(engine.scene, textures, forest, constructions, bus);

  // FX e Áudio 100% procedurais
  const particles = new Particles(engine.scene, settings, bus);
  const audio = new AudioEngine(settings, bus);

  // ViewModel 3D + Jogador em primeira pessoa / Drone
  const viewModel = new ViewModel(engine.viewScene);
  const player = new Player(
    engine.camera,
    input,
    settings,
    viewModel,
    forest,
    constructions,
    simulation,
    audio,
    bus
  );

  // Interfaces (HUD, Mapa Tático, Menus)
  const hud = new HUD(hudRoot, sky, forest, constructions, simulation, player, bus);
  const tacticalMap = new TacticalMap(tmapRoot, constructions, simulation, player, bus);
  const menu = new Menu(menuRoot, settings, simulation, player, bus);

  let gameState = 'title'; // 'title' | 'playing' | 'paused' | 'map'
  let elapsed = 0;
  let lastTime = performance.now();

  function setPlaying(lockPointer = true) {
    gameState = 'playing';
    input.active = true;
    menu.hide();
    tacticalMap.close();
    hud.setVisible(true);
    if (lockPointer) input.requestLock();
  }

  function setPaused() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    input.active = false;
    input.exitLock();
    menu.showPause();
  }

  bus.on('game:start', ({ drone }) => {
    audio.init();
    if (drone) {
      player.teleportTo(0, 260, 0, true);
    } else {
      player.teleportTo(0, 24, 0, false);
    }
    setPlaying(true);
    hud.pushFeed('Acampamento ativo: 30 famílias (150 moradores) prontas para construir a Agro Vila!', 'milestone');
    hud.pushFeed('Os 30 sítios de 50.000 m² já estão cercados. Ajude a cortar madeira ou aperte [M] para o Mapa!', 'info');
  });

  bus.on('game:resume', () => {
    audio.init();
    setPlaying(true);
  });

  bus.on('ui:open-map', () => {
    gameState = 'map';
    input.active = false;
    input.exitLock();
    tacticalMap.open();
  });

  bus.on('ui:map', ({ open }) => {
    if (open) {
      gameState = 'map';
      input.active = false;
      input.exitLock();
    } else if (gameState === 'map') {
      setPlaying(true);
    }
  });

  bus.on('input:unlock', () => {
    if (gameState === 'playing') {
      setPaused();
    }
  });

  bus.on('input:key', ({ code }) => {
    if (code === 'KeyM') {
      if (gameState === 'playing') {
        tacticalMap.open();
      } else if (gameState === 'map') {
        tacticalMap.close();
      }
    } else if (code === 'Escape') {
      if (gameState === 'map') {
        tacticalMap.close();
      } else if (gameState === 'paused') {
        setPlaying(true);
      } else if (gameState === 'playing') {
        setPaused();
      }
    }
  });

  // Loop principal a 60 FPS
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;

    if (gameState === 'title') {
      // Câmera cinematográfica orbitando o acampamento na clareira cercada pela mata fechada
      const angle = elapsed * 0.085;
      const radius = 148;
      engine.camera.position.set(
        Math.sin(angle) * radius,
        62 + Math.sin(elapsed * 0.25) * 8,
        Math.cos(angle) * radius
      );
      engine.camera.lookAt(0, 4, -8);

      // As famílias já se movimentam vivas no acampamento durante a tela inicial!
      simulation.update(dt * 0.45, engine.camera.position);
      forest.update(dt);
      world.update(dt, elapsed, sky.isNight());
      particles.update(dt, world.campfires, engine.camera.position);
      sky.update(dt * 0.2, 1, engine.camera.position);
      engine.render(false);
      return;
    }

    if (gameState === 'playing') {
      player.update(dt, elapsed);
      simulation.update(dt, player.position);
      forest.update(dt);
      world.update(dt, elapsed, sky.isNight());
      particles.update(dt, world.campfires, player.position);
      sky.update(dt, simulation.simSpeed, player.position);
      audio.update(dt, sky.isNight());
      hud.update(dt);
      engine.render(!player.droneMode);
      return;
    }

    if (gameState === 'map') {
      // Mundo continua evoluindo enquanto o jogador coordena pelo Mapa Tático!
      simulation.update(dt, player.position);
      forest.update(dt);
      world.update(dt, elapsed, sky.isNight());
      sky.update(dt, simulation.simSpeed, player.position);
      hud.update(dt);
      tacticalMap.updateLive(dt);
      engine.render(false);
      return;
    }

    // Paused: apenas renderiza quadro congelado
    engine.render(false);
  }

  requestAnimationFrame(animate);
}

boot();

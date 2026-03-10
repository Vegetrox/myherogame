// ============================================================
//  KAKAROT VS CAROTTES — game.js  v6  (boss fights)
// ============================================================
//
//  Paliers de vitesse (score) :
//    0     → x1.0  (base)
//    500   → x1.3
//    1500  → x1.7
//    3000  → x2.2
//    6000  → x3.0
//    10000 → x4.0
//
//  Ce qui accélère à chaque palier :
//    - Nuages far + near
//    - Montagnes
//    - Vitesse des items (carottes, burgers, donuts, power-ups)
//    - Fréquence de spawn
//    - Speed lines (plus intenses)
//    - Vignette FOV (plus sombre)
// ============================================================

const W = window.innerWidth;
const H = window.innerHeight;

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: "#87CEEB",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// ── État principal ──────────────────────────────────────────
let player;
let burgers, carrots, powerups;

let score         = 0;
let lives         = 3;
let nextLifeScore = 10000;
let highScore     = parseInt(localStorage.getItem("burgerHeroHigh") || "0");

// ── Système de boss ──────────────────────────────────────────

// ── Système de power-ups débloquables ───────────────────────
const POWERUP_DEFS = [
  { id:"magnet",  emoji:"🧲", name:"Aimant",    unlock:0,      desc:"Attire les burgers" },
  { id:"shield",  emoji:"🛡️", name:"Bouclier",  unlock:0,      desc:"Absorbe 1 coup" },
  { id:"turbo",   emoji:"⚡", name:"Turbo",     unlock:5000,   desc:"Vitesse x2 pendant 4s" },
  { id:"freeze",  emoji:"❄️", name:"Freeze",    unlock:10000,  desc:"Gèle les carottes 3s" },
  { id:"bomb",    emoji:"💥", name:"Bombe",     unlock:16000,  desc:"Détruit tout l'écran" },
  { id:"star",    emoji:"⭐", name:"Étoile",    unlock:22000,  desc:"Invincible 5s" },
];
let totalScore     = parseInt(localStorage.getItem("burgerHeroTotal") || "0");
let unlockedPowers = new Set(
  JSON.parse(localStorage.getItem('burgerHeroUnlocked') || '["magnet","shield"]')
);
let pauseMenuContainer = null;

// Power-ups actifs étendus
let turboActive  = false;
let freezeActive = false;
let turboTimer   = null;
let freezeTimer  = null;

// Power-up actif unique (un seul à la fois)
let activePowerupId    = null;  // id du power-up actif
let activePowerupTimer = null;  // timer de fin
let powerupHudIcon     = null;  // icône HUD colonne gauche
let powerupHudBar      = null;  // barre de durée

// Cooldown anti-spam spawn (15s par type)
const POWERUP_COOLDOWNS = {};
const POWERUP_SPAWN_COOLDOWN = 15000;

// ── Système de boss ─────────────────────────────────────────

// Combo
let combo           = 0;
let comboMultiplier = 1;
let comboText;

// Textes HUD
let scoreText, livesText, highScoreText;
let startScreen, gameOverContainer, pauseText;

// Flags
let started  = false;
let gameOver = false;
let paused   = false;
let tierTextActive = false;

// Difficulté & spawn
let difficulty  = 3;
let spawnTimer;
let spawnDelay  = 2200; // ms, diminue avec les paliers

// ── Système de boss ─────────────────────────────────────────

// ── Système de paliers de vitesse ───────────────────────────
const SPEED_TIERS = [
  { score: 0,     mult: 1.0 },
  { score: 500,   mult: 1.3 },
  { score: 1500,  mult: 1.7 },
  { score: 3000,  mult: 2.2 },
  { score: 6000,  mult: 3.0 },
  { score: 10000, mult: 4.0 },
];
let currentTier     = 0;  // index dans SPEED_TIERS
let speedMult       = 1.0;

// Vitesses de base des couches parallaxe
const BASE_SPEED_MOUNTAINS  = 0.3;
const BASE_SPEED_CLOUDS_FAR = 0.7;
const BASE_SPEED_CLOUDS_NEAR = 1.5;
const BASE_ITEM_SPEED        = 250;
const BASE_SPAWN_DELAY       = 2200;

// Références aux tileSprites pour mise à jour dynamique
let tileMountains  = null;
let tileCloudsFar  = null;
let tileCloudsNear = null;

// Contrôles clavier
let cursors, keyShift, keyLaser;

// Joystick virtuel mobile
let joyLeft    = false;
let joyRight   = false;
let joyUp      = false;
let joyDown    = false;
let joyActive  = false;
let joyOriginX = 0;
let joyOriginY = 0;
let joyBase, joyThumb;

// Dash
let dashReady  = true;
let dashActive = false;

// Laser
let laserReady = true;

// Invincibilité
let invincible      = false;
let invincibleTimer = null;
let blinkInterval   = null;

// Power-ups actifs
let magnetActive = false;
let shieldActive = false;
let magnetTimer  = null;
let shieldTimer  = null;
let shieldSprite = null;

// Sons
let sfxDash, sfxLaser, sfxHit, sfxStart, sfxGameOver;
let bgMusic;

// ── Système de boss ──────────────────────────────────────────
const BOSS_STAGES = [
  { score: 2000,  hp: 3, patterns: ["straight"] },
  { score: 5000,  hp: 5, patterns: ["straight", "spiral"] },
  { score: 10000, hp: 8, patterns: ["straight", "spiral", "grenade"] },
];
let bossActive      = false;
let bossSprite      = null;   // image boss.png
let bossHP          = 0;
let bossMaxHP       = 0;
let bossTweenY      = null;   // oscillation verticale
let bossShootTimer  = null;
let bossBarBg       = null;   // barre vie fond
let bossBarFill     = null;   // barre vie remplissage
let bossBarText     = null;
let bossStageIdx    = -1;     // index du stage courant
let bossNextIdx     = 0;      // prochain stage à déclencher
let bossProjectiles = [];     // tableau des projectiles actifs
let bossInvincible  = false;  // clignotement hit

// Parallaxe
let bgTiles  = [];
let bgLayers = [];
const layerSpeed = new Map();

// Cooldown UI
let dashCooldownBar, laserCooldownBar;

// ── Speed lines ──────────────────────────────────────────────
let speedLinesGraphics = null;
let speedLinesTimer    = 0;
const SPEED_LINE_COUNT = 18;


// ── Constantes ──────────────────────────────────────────────
// Grille de spawn dynamique (calculée sur H)
const SPAWN_ROWS = [0.15, 0.30, 0.50, 0.70, 0.85];
const CELL_SIZE  = 110; // espacement entre cellules de grille
// Hauteur max (nb rows) de chaque pattern
const PATTERN_MAX_ROW = {
  line_gap: 0, column_gap: 3, tunnel: 2,
  shape_L: 2, shape_T: 2, diagonal: 3, cross: 2
};

// ── Bibliothèque de patterns ─────────────────────────────
// Chaque pattern : liste de {col, row, type}
// type : "carrot" | "burger" | "rand"
// col = décalage horizontal (0=premier), row = décalage vertical
const PATTERNS = {
  // ── Simples (dispo dès le début) ──────────────────────
  line_gap: (gap) => {
    // Ligne horizontale avec un trou à position gap
    const cells = [];
    for (let c = 0; c < 5; c++) {
      if (c !== gap) cells.push({ col: c, row: 0, type: "carrot" });
      else           cells.push({ col: c, row: 0, type: "burger" });
    }
    return cells;
  },
  // ── Colonne avec trou ─────────────────────────────────
  column_gap: (gap) => {
    const cells = [];
    for (let r = 0; r < 4; r++) {
      if (r !== gap) cells.push({ col: 0, row: r, type: "carrot" });
      else           cells.push({ col: 0, row: r, type: "burger" });
    }
    return cells;
  },
  // ── Tunnel horizontal (deux lignes, espace entre) ─────
  tunnel: () => [
    { col:0, row:0, type:"carrot" }, { col:1, row:0, type:"carrot" },
    { col:2, row:0, type:"carrot" }, { col:3, row:0, type:"carrot" },
    { col:0, row:2, type:"carrot" }, { col:1, row:2, type:"carrot" },
    { col:2, row:2, type:"carrot" }, { col:3, row:2, type:"carrot" },
    { col:1, row:1, type:"burger" }, { col:2, row:1, type:"burger" },
  ],
  // ── Forme L (colonne gauche + barre du bas, burger dans l'espace libre) ──
  shape_L: () => [
    { col:0, row:0, type:"carrot" },
    { col:0, row:1, type:"carrot" },
    { col:0, row:2, type:"carrot" },
    { col:1, row:2, type:"carrot" },
    { col:2, row:2, type:"carrot" },
    { col:1, row:0, type:"burger" },
    { col:2, row:0, type:"burger" },
    { col:2, row:1, type:"burger" },
  ],
  // ── Forme T ───────────────────────────────────────────
  shape_T: () => [
    { col:0, row:0, type:"carrot" },
    { col:1, row:0, type:"carrot" },
    { col:2, row:0, type:"carrot" },
    { col:1, row:1, type:"carrot" },
    { col:1, row:2, type:"carrot" },
    { col:0, row:1, type:"burger" },
    { col:2, row:1, type:"burger" },
    { col:0, row:2, type:"burger" },
    { col:2, row:2, type:"burger" },
  ],
  // ── Diagonale ─────────────────────────────────────────
  diagonal: () => [
    { col:0, row:0, type:"carrot" },
    { col:1, row:1, type:"carrot" },
    { col:2, row:2, type:"carrot" },
    { col:3, row:3, type:"carrot" },
    { col:0, row:1, type:"burger" },
    { col:1, row:0, type:"burger" },
    { col:2, row:3, type:"burger" },
  ],
  // ── Croix (centre + 4 branches, coins libres avec burgers) ──
  cross: () => [
    { col:1, row:0, type:"carrot" },
    { col:0, row:1, type:"carrot" },
    { col:1, row:1, type:"carrot" },
    { col:2, row:1, type:"carrot" },
    { col:1, row:2, type:"carrot" },
    { col:0, row:0, type:"burger" },
    { col:2, row:0, type:"burger" },
    { col:0, row:2, type:"burger" },
    { col:2, row:2, type:"burger" },
  ],
};
const DASH_SPEED      = 1200;
const DASH_DURATION   = 200;
const DASH_COOLDOWN   = 2500;
const LASER_COOLDOWN  = 5000;
const MAGNET_RANGE    = 220;
const SHIELD_DURATION = 6000;
const MAGNET_DURATION = 5000;
const isMobileDevice  = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const PLAYER_SPEED    = isMobileDevice ? 280 : 450;
const JOY_X           = 130;
const JOY_Y_OFFSET    = 130;
const JOY_BASE_R      = 70;
const JOY_THUMB_R     = 32;
const JOY_DEAD        = 15;

// ── Métadonnées externes ────────────────────────────────────
const itemMeta   = new Map();
const powerMeta  = new Map();
const carrotMeta = new Map();

// ── Temps flottement sinus ──────────────────────────────────
let _floatTime = 0;

// ============================================================
//  PRELOAD
// ============================================================
function preload() {
  this.load.spritesheet("fly", "assets/Fly.png", { frameWidth: 512, frameHeight: 512 });
  this.load.image("burger", "assets/burger.png");
  this.load.image("carrot", "assets/carrot.png");
  this.load.image("donut",  "assets/donut.png");
  this.load.image("magnet",  "assets/aimant.png");
  this.load.spritesheet("boss", "assets/boss.png", { frameWidth: 512, frameHeight: 512 });
  this.load.image("combo", "assets/combo.png");
  this.load.image("grenade", "assets/grenade.png");
  this.load.image("shield", "assets/bouclier.png");
  this.load.image("turbo",  "assets/turbo.png");
  this.load.image("freeze", "assets/freeze.png");
  this.load.image("bomb",   "assets/bomb.png");
  this.load.image("star",   "assets/star.png");

  this.load.image("bg_sky",          "assets/parallax/sky.png");
  this.load.image("bg_mountains",    "assets/parallax/mountains.png");
  this.load.image("bg_clouds_far",   "assets/parallax/clouds_far.png");
  this.load.image("bg_clouds_near",  "assets/parallax/clouds_near.png");

  this.load.image("boss",     "assets/boss.png");
  this.load.image("grenade",  "assets/grenade.png");

  this.load.audio("dash",     "assets/audio/dash.wav");
  this.load.audio("laser",    "assets/audio/laser.wav");
  this.load.audio("hit",      "assets/audio/hit.wav");
  this.load.audio("start",    "assets/audio/start.wav");
  this.load.audio("gameover", "assets/audio/gameover.wav");
  this.load.audio("music",    "assets/audio/music.wav");
}

// ============================================================
//  CREATE
// ============================================================
function create() {
  createParallaxBackground.call(this);

  burgers  = this.physics.add.group({ maxSize: 40, runChildUpdate: false });
  carrots  = this.physics.add.group({ maxSize: 40, runChildUpdate: false });
  powerups     = this.physics.add.group({ maxSize: 10, runChildUpdate: false });
  comboBubbles = this.physics.add.group({ maxSize: 10, runChildUpdate: false });

  player = this.physics.add.sprite(200, H / 2, "fly");
  player.setScale(0.5);
  player.body.allowGravity = false;
  player.setSize(200, 200);
  player.setDepth(10);

  this.anims.create({
    key: "fly",
    frames: this.anims.generateFrameNumbers("fly", { start: 8, end: 11 }),
    frameRate: 10,
    repeat: -1
  });
  player.play("fly");

  this.anims.create({
    key: "boss_fly",
    frames: this.anims.generateFrameNumbers("boss", { start: 8, end: 11 }),
    frameRate: 10, repeat: -1
  });

  sfxDash     = this.sound.add("dash");
  sfxLaser    = this.sound.add("laser");
  sfxHit      = this.sound.add("hit");
  sfxStart    = this.sound.add("start");
  sfxGameOver = this.sound.add("gameover");

  // ── Speed lines (derrière le joueur, devant le bg) ────────
  speedLinesGraphics = this.add.graphics().setDepth(5);

  buildHUD.call(this);
  buildStartScreen.call(this);
  buildMobileControls.call(this);

  cursors  = this.input.keyboard.createCursorKeys();
  keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  keyLaser = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

  this.input.keyboard.on("keydown-SPACE", () => {
    if (gameOver) return;
    if (!started) startGame.call(this);
  });

  this.input.keyboard.on("keydown-P", () => {
    if (!started || gameOver) return;
    togglePause.call(this);
  });

  this.input.keyboard.on("keydown-I", () => {
    invincible = !invincible;
    player.setTint(invincible ? 0x00ffcc : 0xffffff);
    console.log("Invincible:", invincible);
  });

  this.physics.add.overlap(player, burgers,        collectBurger,    null, this);
  this.physics.add.overlap(player, carrots,        hitCarrot,        null, this);
  this.physics.add.overlap(player, powerups,       collectPowerup,   null, this);
  this.physics.add.overlap(player, comboBubbles,  collectCombo,     null, this);

  spawnTimer = this.time.addEvent({
    delay: BASE_SPAWN_DELAY,
    loop: true,
    callback: spawnPattern,
    callbackScope: this
  });
}

// ============================================================
//  SYSTÈME DE PALIERS
// ============================================================
function checkSpeedTier() {
  let newTier = 0;
  for (let i = SPEED_TIERS.length - 1; i >= 0; i--) {
    if (score >= SPEED_TIERS[i].score) { newTier = i; break; }
  }
  if (newTier <= currentTier) return;

  currentTier = newTier;
  speedMult   = SPEED_TIERS[currentTier].mult;

  spawnDelay = Math.max(600, BASE_SPAWN_DELAY / speedMult);
  if (spawnTimer) spawnTimer.delay = spawnDelay;

  updateItemSpeeds();

  triggerSpeedLineBurst.call(this);
  showTierText.call(this, currentTier);
}

function updateItemSpeeds() {
  const spd = -(BASE_ITEM_SPEED * speedMult);
  burgers.children.iterate(o  => { if (o && o.active) o.setVelocityX(spd); });
  carrots.children.iterate(o  => { if (o && o.active) o.setVelocityX(spd); });
  powerups.children.iterate(o => { if (o && o.active) o.setVelocityX(spd); });
}

function showTierText(tier) {
  if (tierTextActive) return;
  const msgs = ["", "PLUS VITE !", "ÇA ACCÉLÈRE !", "RAPIDE !", "TRÈS RAPIDE !", "VITESSE MAX !"];
  const msg  = msgs[tier] || "";
  if (!msg) return;

  tierTextActive = true;
  const t = this.add.text(W / 2, H / 2 - 80, msg, {
    fontSize: "52px", fill: "#FFD700",
    fontStyle: "bold", stroke: "#ff4400", strokeThickness: 6
  }).setOrigin(0.5).setDepth(35);

  this.tweens.add({
    targets: t, scaleX: 1.3, scaleY: 1.3,
    duration: 200, yoyo: true,
    onComplete: () => {
      this.tweens.add({
        targets: t, alpha: 0, delay: 600, duration: 400,
        onComplete: () => { t.destroy(); tierTextActive = false; }
      });
    }
  });
}

// ============================================================
//  SPEED LINES
// ============================================================
function drawSpeedLines(delta) {
  if (!speedLinesGraphics || !started || paused || currentTier <= 0) {
    speedLinesGraphics.clear();
    return;
  }

  speedLinesTimer += delta;
  if (speedLinesTimer < 100) return;
  speedLinesTimer = 0;

  speedLinesGraphics.clear();

  const intensity = currentTier / (SPEED_TIERS.length - 1); // 0.2 → 1.0
  const count  = 6 + Math.floor(intensity * 14);   // 6 à 20 lignes
  const alpha  = 0.15 + intensity * 0.25;           // 0.15 → 0.40
  const minLen = 80  + intensity * 120;             // 80 → 200
  const maxLen = 200 + intensity * 300;             // 200 → 500

  for (let i = 0; i < count; i++) {
    const y    = Math.random() * H;
    const x    = W * 0.05 + Math.random() * W * 0.9;
    const len  = minLen + Math.random() * (maxLen - minLen);
    const a    = alpha * (0.5 + Math.random() * 0.5);
    const thick = 0.8 + Math.random() * 2;
    speedLinesGraphics.lineStyle(thick, 0xffffff, a);
    speedLinesGraphics.beginPath();
    speedLinesGraphics.moveTo(x, y);
    speedLinesGraphics.lineTo(x - len, y);
    speedLinesGraphics.strokePath();
  }
}

function triggerSpeedLineBurst() {
  if (!speedLinesGraphics) return;
  // Dessine un burst fort immédiat
  speedLinesGraphics.clear();
  for (let i = 0; i < 25; i++) {
    const y    = Math.random() * H;
    const x    = W * 0.1 + Math.random() * W * 0.8;
    const len  = 150 + Math.random() * 350;
    const a    = 0.3 + Math.random() * 0.4;
    speedLinesGraphics.lineStyle(1 + Math.random() * 3, 0xffffff, a);
    speedLinesGraphics.beginPath();
    speedLinesGraphics.moveTo(x, y);
    speedLinesGraphics.lineTo(x - len, y);
    speedLinesGraphics.strokePath();
  }
  speedLinesTimer = 0;
}

function buildMobileControls() {
  const joyY = H - JOY_Y_OFFSET;

  joyBase = this.add.graphics();
  joyBase.fillStyle(0xffffff, 0.12);
  joyBase.fillCircle(0, 0, JOY_BASE_R);
  joyBase.lineStyle(3, 0xffffff, 0.35);
  joyBase.strokeCircle(0, 0, JOY_BASE_R);
  joyBase.setPosition(JOY_X, joyY).setDepth(100);

  joyThumb = this.add.graphics();
  joyThumb.fillStyle(0xffffff, 0.45);
  joyThumb.fillCircle(0, 0, JOY_THUMB_R);
  joyThumb.setPosition(JOY_X, joyY).setDepth(101);

  const joyZone = this.add.zone(JOY_X, joyY, JOY_BASE_R * 3, JOY_BASE_R * 3)
    .setInteractive().setDepth(102);

  joyZone.on("pointerdown", (p) => {
    if (!started || paused || gameOver) { startGame.call(this); return; }
    joyActive  = true;
    joyOriginX = p.x;
    joyOriginY = p.y;
  });

  this.input.on("pointermove", (p) => {
    if (!joyActive) return;
    const dx      = p.x - joyOriginX;
    const dy      = p.y - joyOriginY;
    const dist    = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOY_BASE_R);
    const angle   = Math.atan2(dy, dx);
    joyThumb.setPosition(JOY_X + Math.cos(angle) * clamped, joyY + Math.sin(angle) * clamped);
    joyLeft  = dx < -JOY_DEAD;
    joyRight = dx >  JOY_DEAD;
    joyUp    = dy < -JOY_DEAD;
    joyDown  = dy >  JOY_DEAD;
  });

  this.input.on("pointerup", () => {
    joyActive = false;
    joyLeft = joyRight = joyUp = joyDown = false;
    joyThumb.setPosition(JOY_X, joyY);
  });

  // Bouton DASH
  const dashX = W - 200;
  const dashY = H - 120;
  const dashBg = this.add.graphics();
  dashBg.fillStyle(0x00ccff, 0.2);
  dashBg.fillCircle(0, 0, 55);
  dashBg.lineStyle(3, 0x00ccff, 0.65);
  dashBg.strokeCircle(0, 0, 55);
  dashBg.setPosition(dashX, dashY).setDepth(100);
  this.add.text(dashX, dashY, "DASH", {
    fontSize: "18px", fill: "#00ccff", fontStyle: "bold", stroke: "#000", strokeThickness: 2
  }).setOrigin(0.5).setDepth(101);
  const dashZone = this.add.zone(dashX, dashY, 110, 110).setInteractive().setDepth(102);
  dashZone.on("pointerdown", () => {
    if (!started || paused || gameOver) return;
    dash.call(this);
    this.tweens.add({ targets: dashBg, alpha: 0.7, duration: 80, yoyo: true });
  });

  // Bouton LASER
  const laserX = W - 80;
  const laserY = H - 240;
  const laserBg = this.add.graphics();
  laserBg.fillStyle(0xff4466, 0.2);
  laserBg.fillCircle(0, 0, 55);
  laserBg.lineStyle(3, 0xff4466, 0.65);
  laserBg.strokeCircle(0, 0, 55);
  laserBg.setPosition(laserX, laserY).setDepth(100);
  this.add.text(laserX, laserY, "LASER", {
    fontSize: "16px", fill: "#ff4466", fontStyle: "bold", stroke: "#000", strokeThickness: 2
  }).setOrigin(0.5).setDepth(101);
  const laserZone = this.add.zone(laserX, laserY, 110, 110).setInteractive().setDepth(102);
  laserZone.on("pointerdown", () => {
    if (!started || paused || gameOver) return;
    fireLaser.call(this);
    this.tweens.add({ targets: laserBg, alpha: 0.7, duration: 80, yoyo: true });
  });
}

// ============================================================
//  PARALLAXE
// ============================================================
function createParallaxBackground() {
  const texCache = this.textures;

  // Couche 1 : Ciel statique
  if (texCache.exists("bg_sky")) {
    this.add.image(W / 2, H / 2, "bg_sky").setDisplaySize(W, H).setDepth(-20);
  } else {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xC9E8F5, 0xC9E8F5, 1);
    sky.fillRect(0, 0, W, H);
    sky.setDepth(-20);
  }

  // Couche 2 : Montagnes
  if (texCache.exists("bg_mountains")) {
    const m1 = this.add.image(W / 2,     H / 2, "bg_mountains").setDisplaySize(W, H).setDepth(-15);
    const m2 = this.add.image(W + W / 2, H / 2, "bg_mountains").setDisplaySize(W, H).setDepth(-15);
    tileMountains = { sprite: m1, sprite2: m2, speed: BASE_SPEED_MOUNTAINS, useDouble: true };
    bgTiles.push(tileMountains);
  } else {
    const farLayer = this.add.group();
    for (let i = 0; i < 6; i++) {
      const mx = i * (W / 4);
      const mh = Phaser.Math.Between(H * 0.25, H * 0.45);
      const g  = this.add.graphics();
      g.fillStyle(0x9AB8D0, 1);
      g.fillTriangle(0, H, mx + Phaser.Math.Between(80, 160), H - mh, mx + Phaser.Math.Between(280, 360), H);
      g.setDepth(-15);
      g.x = i * (W / 3.5);
      layerSpeed.set(g, BASE_SPEED_MOUNTAINS);
      farLayer.add(g);
    }
    bgLayers.push(farLayer);
  }

  // Couche 3 : Nuages lointains
  if (texCache.exists("bg_clouds_far")) {
    const tile = this.add.tileSprite(0, 0, W, H, "bg_clouds_far").setOrigin(0, 0).setDepth(-12);
    tileCloudsFar = { sprite: tile, speed: BASE_SPEED_CLOUDS_FAR };
    bgTiles.push(tileCloudsFar);
  } else {
    const midLayer = this.add.group();
    for (let i = 0; i < 7; i++) {
      const g  = this.add.graphics();
      const hw = Phaser.Math.Between(180, 320);
      const hh = Phaser.Math.Between(H * 0.12, H * 0.22);
      g.fillStyle(0xadd8e6, 0.6);
      g.fillEllipse(0, 0, hw * 2, hh * 2);
      g.setDepth(-12);
      g.x = i * (W / 5);
      g.y = H - hh * 0.6;
      layerSpeed.set(g, BASE_SPEED_CLOUDS_FAR);
      midLayer.add(g);
    }
    bgLayers.push(midLayer);
  }

  // Couche 4 : Nuages proches
  if (texCache.exists("bg_clouds_near")) {
    const tile = this.add.tileSprite(0, 0, W, H, "bg_clouds_near").setOrigin(0, 0).setDepth(-8);
    tileCloudsNear = { sprite: tile, speed: BASE_SPEED_CLOUDS_NEAR };
    bgTiles.push(tileCloudsNear);
  } else {
    const cloudLayer = this.add.group();
    const cloudData = [
      { x: W * 0.10, y: H * 0.12, w: 220, h: 70 },
      { x: W * 0.35, y: H * 0.07, w: 300, h: 90 },
      { x: W * 0.60, y: H * 0.15, w: 180, h: 60 },
      { x: W * 0.80, y: H * 0.09, w: 260, h: 80 },
      { x: W * 0.50, y: H * 0.05, w: 200, h: 65 },
      { x: W * 0.20, y: H * 0.20, w: 240, h: 75 },
    ];
    cloudData.forEach(d => {
      const g = this.add.graphics();
      g.fillStyle(0xFFFFFF, 0.92);
      g.fillEllipse(0, 0, d.w, d.h);
      g.fillEllipse(-d.w * 0.28, d.h * 0.05, d.w * 0.6,  d.h * 0.75);
      g.fillEllipse( d.w * 0.25, d.h * 0.08, d.w * 0.55, d.h * 0.65);
      g.setDepth(-8);
      g.x = d.x;
      g.y = d.y;
      layerSpeed.set(g, Phaser.Math.FloatBetween(0.9, 1.8));
      cloudLayer.add(g);
    });
    bgLayers.push(cloudLayer);
  }
}

// ============================================================
//  HUD
// ============================================================
function buildHUD() {
  const hudBg = this.add.graphics();
  hudBg.fillStyle(0x000000, 0.25);
  hudBg.fillRoundedRect(10, 10, 260, 100, 12);
  hudBg.setDepth(20);

  scoreText     = this.add.text(25, 18, "Score: 0",             { fontSize: "26px", fill: "#fff", fontStyle: "bold" }).setDepth(21);
  livesText     = this.add.text(25, 50, "❤️ Lives: 3",           { fontSize: "24px", fill: "#fff" }).setDepth(21);
  highScoreText = this.add.text(25, 80, "🏆 Best: " + highScore, { fontSize: "20px", fill: "#ffe066" }).setDepth(21);

  comboText = this.add.text(W / 2, 30, "", {
    fontSize: "36px", fill: "#FFD700",
    fontStyle: "bold", stroke: "#000", strokeThickness: 4
  }).setOrigin(0.5).setDepth(22).setAlpha(0);

  const barBg1 = this.add.graphics();
  barBg1.fillStyle(0x000000, 0.4);
  barBg1.fillRoundedRect(W - 220, 14, 200, 18, 6);
  barBg1.setDepth(20);

  dashCooldownBar = this.add.graphics().setDepth(21);

  const barBg2 = this.add.graphics();
  barBg2.fillStyle(0x000000, 0.4);
  barBg2.fillRoundedRect(W - 220, 40, 200, 18, 6);
  barBg2.setDepth(20);

  laserCooldownBar = this.add.graphics().setDepth(21);

  this.add.text(W - 228, 12, "DASH",  { fontSize: "14px", fill: "#aef" }).setDepth(22).setOrigin(1, 0);
  this.add.text(W - 228, 38, "LASER", { fontSize: "14px", fill: "#faa" }).setDepth(22).setOrigin(1, 0);

  drawCooldownBars.call(this, 1, 1);

  // ── Boss projectiles : déplacement + collision joueur ─────
  if (bossActive) {
    // ── Suivi Y fluide du boss (60fps avec delta) ─────────────
    if (bossSprite && player) {
      const dy   = player.y - bossSprite.y;
      const step = Math.min(BOSS_CHASE_SPEED * (delta / 1000), Math.abs(dy));
      bossSprite.y += Math.sign(dy) * step;
      bossSprite.y  = Phaser.Math.Clamp(bossSprite.y, 100, H - 100);
    }

    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const p = bossProjectiles[i];
      if (!p || !p.gfx) { bossProjectiles.splice(i, 1); continue; }

      // Déplacement selon type
      if (p.pType === "straight") {
        p.x -= p.spd * (delta / 1000);
      } else if (p.pType === "spiral") {
        p.spiralAngle += p.spiralSpeed * (delta / 1000);
        p.x -= p.spd * (delta / 1000);
        p.y  = p.spiralOriginY + Math.sin(p.spiralAngle) * p.spiralRadius;
      } else if (p.pType === "grenade") {
        p.x  -= p.spd * (delta / 1000);
        p.vy += 500 * (delta / 1000);
        p.y  += p.vy * (delta / 1000);
      }
      p.gfx.setPosition(p.x, p.y);

      // Hors écran → supprimer
      if (p.x < -80 || p.y > H + 80 || p.y < -80) {
        p.gfx.destroy();
        bossProjectiles.splice(i, 1);
        continue;
      }

      // Collision avec le joueur
      const dist = Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y);
      if (dist < 36 && !invincible) {
        p.gfx.destroy();
        bossProjectiles.splice(i, 1);
        spawnHitSparks.call(this, player.x, player.y, 0xff8800);
        loseLife.call(this);
      }
    }
  }
}

function drawCooldownBars(dashFrac, laserFrac) {
  if (!dashCooldownBar) return;
  dashCooldownBar.clear();
  dashCooldownBar.fillStyle(dashFrac >= 1 ? 0x00ccff : 0x336699, 1);
  dashCooldownBar.fillRoundedRect(W - 220, 14, 200 * Math.min(dashFrac, 1), 18, 6);
  laserCooldownBar.clear();
  laserCooldownBar.fillStyle(laserFrac >= 1 ? 0xff4466 : 0x882233, 1);
  laserCooldownBar.fillRoundedRect(W - 220, 40, 200 * Math.min(laserFrac, 1), 18, 6);
}

// ============================================================
//  ÉCRAN TITRE
// ============================================================
function buildStartScreen() {
  startScreen = this.add.container(W / 2, H / 2).setDepth(30);

  const panel = this.add.graphics();
  panel.fillStyle(0x000000, 0.55);
  panel.fillRoundedRect(-340, -220, 680, 460, 24);
  startScreen.add(panel);

  const title = this.add.text(0, -180, "🥕 KAKAROT VS CAROTTES", {
    fontSize: "58px", fill: "#FFD700",
    fontStyle: "bold", stroke: "#000", strokeThickness: 6
  }).setOrigin(0.5);
  startScreen.add(title);

  this.tweens.add({
    targets: title, scaleX: 1.04, scaleY: 1.04,
    duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  const startMsg = isMobileDevice ? "APPUIE N'IMPORTE OÙ POUR DÉMARRER" : "APPUIE SUR ESPACE POUR DÉMARRER";
  const sub = this.add.text(0, -105, startMsg, {
    fontSize: "26px", fill: "#fff", stroke: "#000", strokeThickness: 3
  }).setOrigin(0.5);
  startScreen.add(sub);
  this.tweens.add({ targets: sub, alpha: 0, duration: 600, yoyo: true, repeat: -1 });

  const ctrlTitle = this.add.text(-270, -50, "🖥 Desktop", { fontSize: "18px", fill: "#aef" });
  startScreen.add(ctrlTitle);
  ["← ↑ ↓ →  Voler", "SHIFT  Dash", "F  Laser", "P  Pause"].forEach((line, i) => {
    startScreen.add(this.add.text(-270, -25 + i * 30, line, { fontSize: "18px", fill: "#ddeeff" }));
  });

  const mobTitle = this.add.text(30, -50, "📱 Mobile", { fontSize: "18px", fill: "#ffd" });
  startScreen.add(mobTitle);
  ["Joystick gauche  Voler", "Bouton DASH", "Bouton LASER"].forEach((line, i) => {
    startScreen.add(this.add.text(30, -25 + i * 30, line, { fontSize: "18px", fill: "#ddeeff" }));
  });

  startScreen.add(this.add.text(0, 195, "🏆 Best: " + highScore, {
    fontSize: "26px", fill: "#FFD700", stroke: "#000", strokeThickness: 3
  }).setOrigin(0.5));
}

// ============================================================
//  START GAME
// ============================================================
function startGame() {
  if (started) return;
  started = true;
  startScreen.destroy();
  player.body.allowGravity = false;
  this.physics.world.gravity.y = 0;
  document.body.style.cursor = "none";
  sfxStart.play();
  bgMusic = this.sound.add("music", { loop: true, volume: 0.5 });
  bgMusic.play();
}

// ============================================================

// ============================================================
//  SYSTÈME BOSS
// ============================================================

function checkBossTrigger() {
  if (bossActive || bossNextIdx >= BOSS_STAGES.length) return;
  const stage = BOSS_STAGES[bossNextIdx];
  if (score >= stage.score) {
    bossStageIdx = bossNextIdx;
    bossNextIdx++;
    startBossFight.call(this, stage);
  }
}

function startBossFight(stage) {
  bossActive = true;
  bossHP     = stage.hp;
  bossMaxHP  = stage.hp;
  if (spawnTimer) spawnTimer.paused = true;
  clearObjects();
  bossProjectiles.forEach(p => { if (p.gfx) p.gfx.destroy(); });
  bossProjectiles = [];

  const warn = this.add.text(W / 2, H / 2 - 60, "⚠️ BOSS !", {
    fontSize: "72px", fill: "#ff2200", fontStyle: "bold", stroke: "#000", strokeThickness: 8
  }).setOrigin(0.5).setDepth(40);
  this.cameras.main.shake(400, 0.015);
  this.tweens.add({ targets: warn, alpha: 0, delay: 1200, duration: 400, onComplete: () => warn.destroy() });
  this.time.delayedCall(1600, () => { spawnBoss.call(this, stage); });
}

function spawnBoss(stage) {
  // setFlipX(false) : le boss regarde vers la gauche (vers le joueur)
  bossSprite = this.add.sprite(W + 120, H / 2, "boss")
    .setDisplaySize(360, 400).setDepth(20).setFlipX(false);
  bossSprite.play("boss_fly");

  // Entrée par la droite, position fixe X = W*0.78
  this.tweens.add({
    targets: bossSprite, x: W * 0.78, duration: 1200, ease: "Back.easeOut",
    onComplete: () => {
      buildBossHPBar.call(this);
      startBossShooting.call(this, stage);
      // bossTweenY = null : le déplacement Y est géré dans update (suivi joueur)
    }
  });
}

function buildBossHPBar() {
  if (bossBarBg)   bossBarBg.destroy();
  if (bossBarFill) bossBarFill.destroy();
  if (bossBarText) bossBarText.destroy();
  bossBarBg = this.add.graphics().setDepth(21);
  bossBarBg.fillStyle(0x330000, 0.85);
  bossBarBg.fillRoundedRect(W * 0.35, 18, W * 0.4, 22, 8);
  bossBarBg.lineStyle(2, 0xff4400, 1);
  bossBarBg.strokeRoundedRect(W * 0.35, 18, W * 0.4, 22, 8);
  bossBarFill = this.add.graphics().setDepth(22);
  updateBossHPBar.call(this);
  bossBarText = this.add.text(W / 2, 29, "👹 BOSS", {
    fontSize: "14px", fill: "#ffcc00", fontStyle: "bold"
  }).setOrigin(0.5).setDepth(23);
}

function updateBossHPBar() {
  if (!bossBarFill) return;
  bossBarFill.clear();
  const ratio = Math.max(0, bossHP / bossMaxHP);
  const color = ratio > 0.6 ? 0x44ff44 : ratio > 0.3 ? 0xffaa00 : 0xff2200;
  bossBarFill.fillStyle(color, 1);
  bossBarFill.fillRoundedRect(W * 0.35 + 2, 20, (W * 0.4 - 4) * ratio, 18, 6);
}

// vitesse de suivi Y du boss (pixels/seconde)
const BOSS_CHASE_SPEED = 220;
// stage courant pour le tir (accessible depuis update)
let _bossStage = null;
let _bossShootCooldown = 0;

function startBossShooting(stage) {
  if (bossShootTimer) bossShootTimer.remove();
  _bossStage = stage;
  _bossShootCooldown = 1500;
  // Le timer gère UNIQUEMENT le tir, pas le déplacement
  bossShootTimer = this.time.addEvent({
    delay: 100, loop: true,
    callback: () => {
      if (!bossActive || !bossSprite || !player) return;
      _bossShootCooldown -= 100;
      const dy = player.y - bossSprite.y;
      const aligned = Math.abs(dy) < 40;
      if (aligned && _bossShootCooldown <= 0) {
        const pattern = _bossStage.patterns[Math.floor(Math.random() * _bossStage.patterns.length)];
        shootBossPattern.call(this, pattern);
        _bossShootCooldown = 2500 - bossStageIdx * 200;
      }
    }
  });
}

function shootBossPattern(pattern) {
  if (!bossSprite) return;
  const bx = bossSprite.x - 90;  // bord gauche du boss
  const by = bossSprite.y;
  if (pattern === "straight") {
    // Vrai laser traversant tout l'écran (style fireLaser)
    const count = bossHP <= bossMaxHP / 3 ? 3 : bossHP <= bossMaxHP * 2 / 3 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      this.time.delayedCall(k * 350, () => {
        if (!bossActive) return;
        fireBossLaser.call(this, bx, by + (k - 1) * 55);
      });
    }
  } else if (pattern === "spiral") {
    // Salve de 4 boules espacées en spirale, lancées en éventail
    for (let k = 0; k < 4; k++) {
      this.time.delayedCall(k * 180, () => {
        if (!bossActive) return;
        spawnBossProjectile.call(this, bx, by, "spiral", {
          angle: k * (Math.PI / 2),  // éventail à 90° chacune
          radius: 80
        });
      });
    }
  } else if (pattern === "grenade") {
    for (let k = 0; k < 2; k++) {
      this.time.delayedCall(k * 300, () => {
        if (!bossActive) return;
        spawnBossProjectile.call(this, bx, by - 30, "grenade");
      });
    }
  }
}

function fireBossLaser(fromX, fromY) {
  // Laser qui part du boss vers la GAUCHE, traverse tout l'écran
  const laserLen = fromX + 60; // longueur jusqu'au bord gauche
  const ly = fromY;

  // Flash de charge au niveau du boss
  const charge = this.add.circle(fromX, ly, 14, 0xff4400, 1).setDepth(19);
  this.tweens.add({ targets: charge, scaleX: 3, scaleY: 3, alpha: 0, duration: 150,
    onComplete: () => charge.destroy() });

  this.time.delayedCall(150, () => {
    if (!bossActive) return;

    // Rectangle partant du boss vers la gauche : setOrigin(1, 0.5)
    const laserOuter = this.add.rectangle(fromX, ly, laserLen, 40, 0xff4400, 0.85).setOrigin(1, 0.5).setDepth(17);
    const laserMid   = this.add.rectangle(fromX, ly, laserLen, 20, 0xff8800, 0.90).setOrigin(1, 0.5).setDepth(18);
    const laserCore  = this.add.rectangle(fromX, ly, laserLen,  8, 0xffcc00, 1.00).setOrigin(1, 0.5).setDepth(19);
    const glow       = this.add.rectangle(fromX, ly, laserLen, 70, 0xff4400, 0.20).setOrigin(1, 0.5).setDepth(16);

    // Collision laser boss → 1 vie perdue directement
    const py = player.y;
    if (Math.abs(py - ly) < 45 && player.x < fromX && !invincible) {
      spawnHitSparks.call(this, player.x, player.y, 0xff8800);
      loseLife.call(this);  // 1 touche = 1 vie perdue
    }

    this.cameras.main.shake(100, 0.006);

    // Scintillement
    let f = 0;
    this.time.addEvent({ delay: 50, repeat: 4, callback: () => {
      const v = f % 2 === 0 ? 0.1 : 1;
      [laserOuter, laserMid, laserCore, glow].forEach(r => r.setAlpha(v));
      f++;
    }});

    // Disparition
    this.time.delayedCall(350, () => {
      this.tweens.add({
        targets: [laserOuter, laserMid, laserCore, glow],
        alpha: 0, scaleY: 0, duration: 180,
        onComplete: () => [laserOuter, laserMid, laserCore, glow].forEach(r => r.destroy())
      });
    });
  });
}

function spawnBossProjectile(x, y, pType, opts) {
  opts = opts || {};
  const gfx = this.add.graphics().setDepth(18);
  if (pType === "straight") {
    // Laser boss — grand rectangle orange vers la gauche
    gfx.fillStyle(0xff4400, 0.9); gfx.fillRect(-70, -8, 140, 16);
    gfx.fillStyle(0xff8800, 1);   gfx.fillRect(-60, -5, 120, 10);
    gfx.fillStyle(0xffcc00, 0.9); gfx.fillRect(-50, -3, 100,  6);
    gfx.fillStyle(0xffffff, 0.8); gfx.fillRect(-35, -2,  70,  4);
  } else if (pType === "spiral") {
    gfx.fillStyle(0x8800ff, 0.9); gfx.fillCircle(0, 0, 18);
    gfx.fillStyle(0xcc44ff, 0.8); gfx.fillCircle(0, 0, 12);
    gfx.fillStyle(0xff88ff, 0.7); gfx.fillCircle(0, 0,  7);
    gfx.fillStyle(0xffffff, 0.9); gfx.fillCircle(0, 0,  3);
  } else if (pType === "grenade") {
    gfx.fillStyle(0x226622, 1);   gfx.fillCircle(0, 0, 14);
    gfx.fillStyle(0x44aa44, 0.8); gfx.fillCircle(-3, -3, 7);
    gfx.lineStyle(3, 0xffcc00, 1);
    gfx.beginPath(); gfx.moveTo(6, -10); gfx.lineTo(10, -18); gfx.strokePath();
  }
  gfx.setPosition(x, y);
  bossProjectiles.push({
    gfx, x, y, pType,
    spd: 380 + bossStageIdx * 40,
    spiralOriginY: y,
    spiralAngle: opts.angle || 0,
    spiralSpeed: 6,
    spiralRadius: opts.radius || 80,
    vy: -180,
  });
}

function hitBoss() {
  if (bossInvincible) return;
  bossHP--;
  updateBossHPBar.call(this);
  this.cameras.main.shake(150, 0.01);
  bossInvincible = true;
  let blink = 0;
  this.time.addEvent({ delay: 80, repeat: 5, callback: () => {
    if (!bossSprite) return;
    bossSprite.setAlpha(blink % 2 === 0 ? 0.2 : 1); blink++;
  }});
  this.time.delayedCall(500, () => { bossInvincible = false; if (bossSprite) bossSprite.setAlpha(1); });
  spawnHitSparks.call(this, bossSprite.x, bossSprite.y, 0xff8800);
  score += 100; scoreText.setText("Score: " + score);
  if (bossHP <= 0) killBoss.call(this);
}

function killBoss() {
  bossActive = false;
  if (bossShootTimer) { bossShootTimer.remove(); bossShootTimer = null; }
  if (bossTweenY)     { bossTweenY.stop();       bossTweenY     = null; }
  bossProjectiles.forEach(p => { if (p.gfx) p.gfx.destroy(); });
  bossProjectiles = [];
  // Reset multiplicateur combo à la mort du boss
  combo = 0; comboMultiplier = 1;
  if (comboText) comboText.setAlpha(0);

  const win = this.add.text(W / 2, H / 2 - 40, "💥 BOSS VAINCU !", {
    fontSize: "56px", fill: "#FFD700", fontStyle: "bold", stroke: "#000", strokeThickness: 7
  }).setOrigin(0.5).setDepth(40);

  for (let i = 0; i < 8; i++) {
    this.time.delayedCall(i * 80, () => {
      if (!bossSprite) return;
      spawnHitSparks.call(this,
        bossSprite.x + Phaser.Math.Between(-60, 60),
        bossSprite.y + Phaser.Math.Between(-60, 60), 0xff8800);
    });
  }
  this.cameras.main.shake(500, 0.02);

  if (bossSprite) {
    this.tweens.add({
      targets: bossSprite, y: H + 200, alpha: 0, duration: 900, ease: "Quad.easeIn",
      onComplete: () => { if (bossSprite) { bossSprite.destroy(); bossSprite = null; } }
    });
  }
  this.time.delayedCall(800, () => {
    if (bossBarBg)   { bossBarBg.destroy();   bossBarBg   = null; }
    if (bossBarFill) { bossBarFill.destroy();  bossBarFill = null; }
    if (bossBarText) { bossBarText.destroy();  bossBarText = null; }
  });
  this.time.delayedCall(2000, () => {
    win.destroy();
    if (spawnTimer) spawnTimer.paused = false;
  });
}

function resetBoss() {
  bossActive     = false;
  bossNextIdx    = 0;
  bossStageIdx   = -1;
  bossInvincible = false;
  if (bossShootTimer) { bossShootTimer.remove(); bossShootTimer = null; }
  if (bossTweenY)     { bossTweenY.stop();       bossTweenY     = null; }
  if (bossSprite)     { bossSprite.destroy();     bossSprite     = null; }
  if (bossBarBg)      { bossBarBg.destroy();      bossBarBg      = null; }
  if (bossBarFill)    { bossBarFill.destroy();    bossBarFill    = null; }
  if (bossBarText)    { bossBarText.destroy();    bossBarText    = null; }
  bossProjectiles.forEach(p => { if (p.gfx) p.gfx.destroy(); });
  bossProjectiles = [];
}

//  SPAWN
// ============================================================
function spawnPattern() {
  if (!started || paused || gameOver) return;

  difficulty = 3 + Math.floor(score / 800);
  difficulty = Math.min(difficulty, 8);

  const baseX = W + 50;

  // Chance de spawner un power-up seul (hors pattern)
  const now = Date.now();
  const availPow = ["magnet","shield","turbo","freeze","bomb","star"].filter(id => {
    if (!unlockedPowers.has(id)) return false;
    const lastSpawn = POWERUP_COOLDOWNS[id] || 0;
    return (now - lastSpawn) > POWERUP_SPAWN_COOLDOWN;
  });

  if (availPow.length > 0 && Math.random() < 0.18) {
    // Spawn DUO : un power-up + une bulle combo à deux hauteurs différentes
    const pid = availPow[Math.floor(Math.random() * availPow.length)];
    POWERUP_COOLDOWNS[pid] = now;

    // Deux lignes différentes (garantir un écart d'au moins 2 slots)
    const rowA = Phaser.Math.Between(0, SPAWN_ROWS.length - 1);
    let rowB = Phaser.Math.Between(0, SPAWN_ROWS.length - 1);
    if (Math.abs(rowB - rowA) < 2) rowB = (rowA + 2) % SPAWN_ROWS.length;
    const pyA = H * SPAWN_ROWS[rowA];
    const pyB = H * SPAWN_ROWS[rowB];

    // Aléatoire : power-up en haut ou en bas
    if (Math.random() < 0.5) {
      spawnPowerupBubble.call(this, baseX, pyA, pid);
      spawnComboBubble.call(this, baseX, pyB);
    } else {
      spawnComboBubble.call(this, baseX, pyA);
      spawnPowerupBubble.call(this, baseX, pyB, pid);
    }
    return;
  }

  // Avant 300 pts : lignes simples
  if (score < 300) {
    const row   = Phaser.Math.Between(0, SPAWN_ROWS.length - 1);
    const baseY = H * SPAWN_ROWS[row];
    for (let i = 0; i < difficulty; i++) {
      spawnObject.call(this, baseX + i * 160, baseY, "rand");
    }
    return;
  }

  // Patterns géométriques (sans power-ups dedans)
  spawnGeometricPattern.call(this, baseX);
}


// ============================================================
//  BULLES MULTIPLICATEUR COMBO
// ============================================================

// Groupe physique pour les bulles combo
let comboBubbles = null; // initialisé dans create()

function getComboLevel() {
  if (score >= 5000) return 4;
  if (score >= 1000) return 3;
  return 2;
}

function spawnComboBubble(x, y) {
  if (!comboBubbles) return;
  const level = getComboLevel();

  let cb = comboBubbles.getFirstDead(false);
  if (!cb || !cb.body) { cb = comboBubbles.create(x, y, "combo"); }
  else {
    cb.setTexture("combo");
    cb.setActive(true).setVisible(true);
    cb.setPosition(x, y);
    cb.body.reset(x, y);
  }
  if (!cb || !cb.body) return;

  cb.body.allowGravity = false;
  cb.setVelocityX(-BASE_ITEM_SPEED * speedMult);
  cb.setScale(0.9);
  cb.clearTint();
  // Teinte selon le niveau
  if      (level === 4) cb.setTint(0xffdd00); // or
  else if (level === 3) cb.setTint(0x88ffff); // cyan
  else                  cb.setTint(0xffffff); // blanc x2

  // Étiquette niveau dans la bulle
  const label = this.add.text(x, y - 42, "x" + level, {
    fontSize: "20px", fill: "#ffffff", fontStyle: "bold",
    stroke: "#000000", strokeThickness: 4
  }).setOrigin(0.5).setDepth(12);

  // Bulle décorative
  const bubble = this.add.circle(x, y, 38, 0xffffff, 0.12).setDepth(8);

  powerMeta.set(cb, {
    powerType: "combo_x" + level,
    comboLevel: level,
    gridY: y,
    floatOffset: Math.random() * Math.PI * 2,
    floatAmplitude: 30,
    isBubble: true,
    bubble: bubble,
    label: label,
  });
}

function collectCombo(playerObj, cb) {
  if (!started || !cb.active) return;
  const meta = powerMeta.get(cb);
  if (!meta) return;

  // Détruire bulle + label
  if (meta.bubble) { meta.bubble.destroy(); meta.bubble = null; }
  if (meta.label)  { meta.label.destroy();  meta.label  = null; }
  cb.setActive(false).setVisible(false);

  const level = meta.comboLevel || 2;
  comboMultiplier = level;

  // Texte flottant
  showFloatingPoints.call(this, playerObj.x, playerObj.y - 50,
    "x" + level + " COMBO !", level === 4 ? "#ffdd00" : level === 3 ? "#88ffff" : "#ffffff");

  // Afficher dans le HUD combo
  if (comboText) {
    comboText.setText("x" + level).setAlpha(1).setScale(1);
    this.tweens.add({ targets: comboText, scaleX: 1.3, scaleY: 1.3,
      duration: 150, yoyo: true });
  }
}

function spawnPowerupBubble(x, y, pid) {
  const def = POWERUP_DEFS.find(d => d.id === pid);
  if (!def) return;

  const currentSpeed = BASE_ITEM_SPEED * speedMult;

  // Créer depuis le pool
  let pu = powerups.getFirstDead(false);
  if (!pu || !pu.body) { pu = powerups.create(x, y, pid); }
  else {
    pu.setTexture(pid);
    pu.setActive(true).setVisible(true);
    pu.setPosition(x, y);
    pu.body.reset(x, y);
  }
  if (!pu || !pu.body) return;

  pu.body.allowGravity = false;
  pu.setVelocityX(-currentSpeed);
  pu.setScale(0.9);
  pu.clearTint();

  powerMeta.set(pu, {
    powerType: pid,
    gridY: y,
    floatOffset: Math.random() * Math.PI * 2,
    floatAmplitude: 30,   // ondulation plus ample pour les power-ups
    isBubble: true
  });

  // Bulle décorative autour du power-up
  const bubble = this.add.circle(x, y, 38, 0xffffff, 0.12).setDepth(8);
  this.add.circle(x, y, 38, 0x000000, 0).setDepth(8);
  // Stocker la bulle dans powerMeta pour la déplacer
  const meta = powerMeta.get(pu);
  meta.bubble = bubble;

  // Pas de tween pulsation — juste l'ondulation sinus dans update
}

function spawnGeometricPattern(baseX) {
  // Choisir le pattern selon le score
  let available;
  if (score < 800) {
    available = ["line_gap", "column_gap"];
  } else if (score < 2000) {
    available = ["line_gap", "column_gap", "tunnel", "diagonal"];
  } else {
    available = ["line_gap", "column_gap", "tunnel", "diagonal", "shape_L", "shape_T", "cross"];
  }

  const name = available[Math.floor(Math.random() * available.length)];

  let cells;
  if (name === "line_gap") {
    cells = PATTERNS.line_gap(Phaser.Math.Between(0, 4));
  } else if (name === "column_gap") {
    cells = PATTERNS.column_gap(Phaser.Math.Between(0, 3));
  } else {
    cells = PATTERNS[name]();
  }

  // Calcul anchorY adapté au pattern pour garantir que TOUTES les cellules restent à l'écran
  const maxRow    = PATTERN_MAX_ROW[name] || 0;
  const marginTop = H * 0.10;
  const marginBot = H * 0.88 - maxRow * CELL_SIZE - 40;
  const anchorY   = marginTop + Math.random() * Math.max(0, marginBot - marginTop);

  // Déduplication : on filtre les positions déjà occupées
  const placed = new Set();
  cells.forEach(cell => {
    const x   = baseX + cell.col * CELL_SIZE;
    const y   = anchorY + cell.row * CELL_SIZE;
    const key = `${cell.col},${cell.row}`;
    if (y > H - 40 || y < 40) return;
    if (placed.has(key)) return; // évite tout doublon
    placed.add(key);
    spawnObject.call(this, x, y, cell.type);
  });
}

function spawnObject(x, y, forcedType) {
  const currentSpeed = BASE_ITEM_SPEED * speedMult;

  // forcedType : "carrot", "burger", "rand" ou undefined
  const isCarrot = forcedType === "carrot" ||
    (forcedType !== "burger" && Math.random() > 0.6);

  if (isCarrot) {
    let carrot = carrots.getFirstDead(false);
    if (!carrot || !carrot.body) {
      carrot = carrots.create(x, y, "carrot");
    } else {
      carrot.setActive(true).setVisible(true);
      carrot.setPosition(x, y);
      carrot.body.reset(x, y);
    }
    if (!carrot || !carrot.body) return; // sécurité
    carrot.body.allowGravity = false;
    carrot.setVelocityX(-currentSpeed);
    carrot.setAngularVelocity(Phaser.Math.Between(-60, 60));
    carrotMeta.set(carrot, { gridY: y, floatOffset: Math.random() * Math.PI * 2, floatAmplitude: Phaser.Math.Between(8, 18) });

  } else {
    // Dans les patterns : uniquement burger ou donut, jamais de power-up
    const key = Math.random() < 0.20 ? "donut" : "burger";
    let item = burgers.getFirstDead(false);
    if (!item || !item.body) {
      item = burgers.create(x, y, key);
    } else {
      item.setTexture(key);
      item.setActive(true).setVisible(true);
      item.setPosition(x, y);
      item.body.reset(x, y);
    }
    if (!item || !item.body) return;
    item.body.allowGravity = false;
    item.setVelocityX(-currentSpeed);
    item.setScale(1.5);
    item.setAngularVelocity(Phaser.Math.Between(-40, 40));
    itemMeta.set(item, {
      superBurger: (key === "donut"), gridY: y,
      floatOffset: Math.random() * Math.PI * 2,
      floatAmplitude: Phaser.Math.Between(10, 20)
    });
  }
}


// ============================================================
//  UPDATE
// ============================================================
function update(time, delta) {
  if (paused || gameOver) return;

  _floatTime += delta;

  // ── Vitesses parallaxe dynamiques ─────────────────────────
  const mSpd  = BASE_SPEED_MOUNTAINS   * speedMult;
  const cfSpd = BASE_SPEED_CLOUDS_FAR  * speedMult;
  const cnSpd = BASE_SPEED_CLOUDS_NEAR * speedMult;

  if (tileMountains)  { tileMountains.speed  = mSpd; }
  if (tileCloudsFar)  { tileCloudsFar.speed  = cfSpd; }
  if (tileCloudsNear) { tileCloudsNear.speed = cnSpd; }

  // ── Parallaxe tileSprite ───────────────────────────────────
  bgTiles.forEach(layer => {
    if (layer.speed <= 0) return;
    if (layer.useDouble) {
      const spd = layer.speed * (delta / 16);
      layer.sprite.x  -= spd;
      layer.sprite2.x -= spd;
      if (layer.sprite.x  <= -W / 2) layer.sprite.x  = layer.sprite2.x + W;
      if (layer.sprite2.x <= -W / 2) layer.sprite2.x = layer.sprite.x  + W;
    } else if (layer.sprite && layer.sprite.tilePositionX !== undefined) {
      layer.sprite.tilePositionX += layer.speed * (delta / 16);
    }
  });

  // ── Parallaxe procédurale de secours ──────────────────────
  bgLayers.forEach(layer => {
    layer.children.iterate(obj => {
      const spd = (layerSpeed.get(obj) || 0) * speedMult;
      if (spd <= 0) return;
      obj.x -= spd * (delta / 16);
      if (obj.x + (obj.displayWidth || 300) / 2 < 0) obj.x = W + (obj.displayWidth || 300) / 2;
    });
  });

  if (!started) return;

  // ── Speed lines ───────────────────────────────────────────
  drawSpeedLines(delta);

  // ── Flottement sinus ──────────────────────────────────────
  const applyFloat = (group, metaMap) => {
    group.children.iterate(item => {
      if (!item || !item.active) return;
      const meta = metaMap.get(item);
      if (meta) {
        // Skip flottement si l'item est en cours d'attraction magnétique
        if (!meta.magnetized) {
          item.y = meta.gridY + Math.sin(_floatTime * 0.002 + meta.floatOffset) * meta.floatAmplitude;
        } else {
          // Mettre à jour gridY pour éviter un saut quand le magnet s'arrête
          meta.gridY = item.y;
        }
        // Déplacer la bulle avec le power-up
        if (meta.bubble) {
          if (meta.bubble.active !== false) {
            meta.bubble.setPosition(item.x, item.y);
          }
        }
        // Déplacer le label combo
        if (meta.label) {
          meta.label.setPosition(item.x, item.y - 42);
        }
      }
    });
  };
  applyFloat(burgers,      itemMeta);
  applyFloat(carrots,      carrotMeta);
  applyFloat(powerups,     powerMeta);
  applyFloat(comboBubbles, powerMeta);

  // ── Déplacement joueur ─────────────────────────────────────
  if (!dashActive) {
    let vx = 0, vy = 0;
    if (cursors.left.isDown)  vx = -PLAYER_SPEED;
    if (cursors.right.isDown) vx =  PLAYER_SPEED;
    if (cursors.up.isDown)    vy = -PLAYER_SPEED;
    if (cursors.down.isDown)  vy =  PLAYER_SPEED;
    if (joyLeft)  vx = -PLAYER_SPEED;
    if (joyRight) vx =  PLAYER_SPEED;
    if (joyUp)    vy = -PLAYER_SPEED;
    if (joyDown)  vy =  PLAYER_SPEED;
    const turboMult = turboActive ? 2 : 1;
    player.setVelocityX(vx * turboMult);
    player.setVelocityY(vy * turboMult);
  }

  if (Phaser.Input.Keyboard.JustDown(keyShift)) dash.call(this);
  if (Phaser.Input.Keyboard.JustDown(keyLaser)) fireLaser.call(this);

  // ── Limites écran ──────────────────────────────────────────
  if (player.y < 40)     { player.y = 40;     player.setVelocityY(0); }
  if (player.y > H - 40) { player.y = H - 40; player.setVelocityY(0); }
  if (player.x < 60) { player.x = 60; player.setVelocityX(0); }
  // Empêcher le joueur de passer derrière le boss
  const bossWall = bossActive && bossSprite ? bossSprite.x - 170 : W - 60;
  if (player.x > bossWall) { player.x = bossWall; player.setVelocityX(0); }

  if (shieldSprite) shieldSprite.setPosition(player.x, player.y);

  cleanOffscreen(burgers);
  cleanOffscreen(carrots);
  cleanOffscreen(powerups);
  cleanOffscreen(comboBubbles);

  if (magnetActive) {
    const spd = BASE_ITEM_SPEED * speedMult;
    burgers.children.iterate(item => {
      if (!item || !item.active || !item.body) return;
      const dx   = player.x - item.x;
      const dy   = player.y - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const meta = itemMeta.get(item);
      if (dist < MAGNET_RANGE && dist > 5) {
        const nx = dx / dist;
        const ny = dy / dist;
        const attractSpeed = 400 + (1 - dist / MAGNET_RANGE) * 400;
        item.body.velocity.x = nx * attractSpeed;
        item.body.velocity.y = ny * attractSpeed;
        // Marquer l'item comme aimanté pour suspendre le flottement sinus
        if (meta) meta.magnetized = true;
      } else if (dist >= MAGNET_RANGE) {
        item.body.velocity.x = -spd;
        item.body.velocity.y = 0;
        if (meta) meta.magnetized = false;
      }
    });
  }

  drawCooldownBars.call(this, dashReady ? 1 : 0, laserReady ? 1 : 0);
}

// ============================================================
//  NETTOYAGE
// ============================================================
function cleanOffscreen(group) {
  group.children.iterate(obj => {
    if (obj && obj.active && obj.x < -150) {
      obj.clearTint();
      // Détruire la bulle associée si power-up
      const meta = powerMeta.get(obj);
      if (meta && meta.bubble) { meta.bubble.destroy(); meta.bubble = null; }
      obj.setActive(false).setVisible(false);
    }
  });
}

// ============================================================
//  DASH
// ============================================================
function dash() {
  if (!dashReady || dashActive) return;
  dashReady = false; dashActive = true;
  sfxDash.play();
  const goLeft = cursors.left.isDown || joyLeft;
  const dir    = goLeft ? -1 : 1;
  player.setVelocityX(dir * DASH_SPEED);
  for (let i = 0; i < 10; i++) {
    this.time.delayedCall(i * 25, () => {
      const ghost = this.add.sprite(player.x, player.y, "fly", 11);
      ghost.setScale(0.5).setTint(i % 2 === 0 ? 0xFF8800 : 0xFFDD00).setAlpha(0.7).setDepth(9);
      this.tweens.add({ targets: ghost, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 300, ease: "Quad.easeOut", onComplete: () => ghost.destroy() });
    });
  }
  const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.15).setDepth(50);
  this.tweens.add({ targets: flash, alpha: 0, duration: 120, onComplete: () => flash.destroy() });
  this.time.delayedCall(DASH_DURATION, () => { dashActive = false; });
  this.time.delayedCall(DASH_COOLDOWN, () => { dashReady  = true; });
}

// ============================================================
//  LASER
// ============================================================
function fireLaser() {
  if (!laserReady) return;
  laserReady = false;
  sfxLaser.play();

  // Point de départ : torse du personnage (légèrement devant lui)
  const lx = player.x + 32;
  const ly = player.y;
  const laserLen = W - lx + 100; // jusqu'au bord droit de l'écran

  // Flash de charge au niveau du torse
  const chargeCircle = this.add.circle(lx, ly, 8, 0xff0040, 0.9).setDepth(15);
  this.tweens.add({ targets: chargeCircle, scaleX: 4, scaleY: 4, alpha: 0, duration: 120, onComplete: () => chargeCircle.destroy() });

  this.time.delayedCall(100, () => {
    // setOrigin(0, 0.5) : le rectangle part de lx vers la droite uniquement
    const laserOuter = this.add.rectangle(lx, ly, laserLen, 44, 0xff0040, 0.85).setOrigin(0, 0.5).setDepth(14);
    const laserMid   = this.add.rectangle(lx, ly, laserLen, 22, 0xff6688, 0.90).setOrigin(0, 0.5).setDepth(15);
    const laserCore  = this.add.rectangle(lx, ly, laserLen,  8, 0xffffff, 1.00).setOrigin(0, 0.5).setDepth(16);
    const glow       = this.add.rectangle(lx, ly, laserLen, 80, 0xff0040, 0.25).setOrigin(0, 0.5).setDepth(13);

    // Détruire les carottes à droite du joueur
    carrots.children.each(c => {
      if (c && c.active && c.x > lx) {
        spawnHitSparks.call(this, c.x, c.y, 0xff4466);
        c.setActive(false).setVisible(false);
      }
    });
    // Toucher le boss
    if (bossActive && bossSprite && !bossInvincible) {
      hitBoss.call(this);
    }

    this.cameras.main.shake(120, 0.005);

    // Scintillement
    let flickerCount = 0;
    this.time.addEvent({ delay: 40, repeat: 4, callback: () => {
      const v = flickerCount % 2 === 0 ? 0 : 1;
      [laserOuter, laserMid, laserCore, glow].forEach(r =>
        r.setAlpha(v * (r === laserCore ? 1 : r === laserMid ? 0.9 : 0.85))
      );
      flickerCount++;
    }});

    // Disparition
    this.time.delayedCall(280, () => {
      this.tweens.add({
        targets: [laserOuter, laserMid, laserCore, glow],
        alpha: 0, scaleY: 0, duration: 150,
        onComplete: () => [laserOuter, laserMid, laserCore, glow].forEach(r => r.destroy())
      });
    });
  });

  this.time.delayedCall(LASER_COOLDOWN, () => { laserReady = true; });
}

// ============================================================
//  COLLECTE BURGER
// ============================================================
function collectBurger(playerObj, item) {
  if (!started || !item.active) return;
  item.setActive(false).setVisible(false);
  const meta = itemMeta.get(item);
  const isSuperBurger = meta ? meta.superBurger : false;
  // comboMultiplier obtenu uniquement via bulle combo — pas d'incrémentation auto
  const pts = (isSuperBurger ? 50 : 10) * comboMultiplier;
  score += pts;
  scoreText.setText("Score: " + score);
  updateHighScore.call(this);
  addToTotalScore.call(this, pts);
  checkSpeedTier.call(this);
  checkBossTrigger.call(this);
  if (comboMultiplier > 1) showComboText.call(this, comboMultiplier);
  showFloatingPoints.call(this, item.x, item.y, "+" + pts, comboMultiplier > 1 ? "#FFD700" : "#fff");
  if (score >= nextLifeScore) {
    lives++;
    livesText.setText("❤️ Lives: " + lives);
    nextLifeScore += 10000;
    showFloatingPoints.call(this, player.x, player.y - 60, "+1 VIE", "#ff88cc");
  }
}

// ============================================================
//  COLLECTE POWER-UP
// ============================================================
function collectPowerup(playerObj, pu) {
  if (!started || !pu.active) return;
  this.tweens.killTweensOf(pu);
  // Détruire la bulle associée
  const puMetaC = powerMeta.get(pu);
  if (puMetaC && puMetaC.bubble) { puMetaC.bubble.destroy(); puMetaC.bubble = null; }
  pu.setActive(false).setVisible(false);
  const puMeta = powerMeta.get(pu);
  const puType = puMeta ? puMeta.powerType : null;
  if      (puType === "magnet") { activateMagnet.call(this); showFloatingPoints.call(this, pu.x, pu.y, "🧲 AIMANT!", "#88ddff"); }
  else if (puType === "shield") { activateShield.call(this); showFloatingPoints.call(this, pu.x, pu.y, "🛡️ BOUCLIER!", "#88ffcc"); }
  else if (puType === "turbo")  { activateTurbo.call(this);  showFloatingPoints.call(this, pu.x, pu.y, "⚡ TURBO!", "#ffee00"); }
  else if (puType === "freeze") { activateFreeze.call(this); showFloatingPoints.call(this, pu.x, pu.y, "❄️ FREEZE!", "#aaeeff"); }
  else if (puType === "bomb")   { activateBomb.call(this);   showFloatingPoints.call(this, pu.x, pu.y, "💥 BOMBE!", "#ff8800"); }
  else if (puType === "star")   { activateStar.call(this);   showFloatingPoints.call(this, pu.x, pu.y, "⭐ ÉTOILE!", "#ffffaa"); }
}

// ============================================================
//  HUD POWER-UP ACTIF (colonne gauche)
// ============================================================
function clearActivePowerup() {
  // Arrêter le power-up actif proprement
  if (activePowerupId === "magnet")  { magnetActive = false; if (magnetTimer) { magnetTimer.remove(); magnetTimer = null; } }
  if (activePowerupId === "turbo")   { turboActive  = false; if (turboTimer)  { turboTimer.remove();  turboTimer  = null; } }
  if (activePowerupId === "freeze")  {
    freezeActive = false;
    if (freezeTimer) { freezeTimer.remove(); freezeTimer = null; }
    const spd = -(BASE_ITEM_SPEED * speedMult);
    carrots.children.iterate(c => { if (c && c.active) { c.setVelocityX(spd); c.clearTint(); } });
  }
  if (activePowerupId === "shield")  { shieldActive = false; if (shieldSprite) { shieldSprite.destroy(); shieldSprite = null; } }
  if (activePowerupId === "star")    { invincible = false; player.clearTint(); }
  activePowerupId = null;
  clearPowerupHUD.call(this);
}

function clearPowerupHUD() {
  destroyPowerupHUDFull.call(this);
}

function updatePowerupHUD(emoji, color, duration) {
  clearPowerupHUD.call(this);

  // Position : bas gauche, au-dessus du joystick mobile
  const hx = 60;
  const hy = H / 2;  // milieu de l'écran

  // Fond carte
  const card = this.add.graphics().setDepth(25);
  card.fillStyle(0x000000, 0.55);
  card.fillRoundedRect(hx - 38, hy - 38, 76, duration > 0 ? 95 : 76, 12);
  powerupHudIcon = card;

  // Image PNG du power-up (même asset qu'in-game)
  const def = POWERUP_DEFS.find(d => d.emoji === emoji) || POWERUP_DEFS.find(d => d.id === activePowerupId);
  const imgKey = def ? def.id : null;
  let eText;
  if (imgKey && this.textures.exists(imgKey)) {
    eText = this.add.image(hx, hy, imgKey).setDisplaySize(44, 44).setDepth(26);
  } else {
    eText = this.add.text(hx, hy, emoji, { fontSize: "34px" }).setOrigin(0.5).setDepth(26);
  }
  powerupHudIcon._eText = eText;

  // Label "PERMANENT" ou barre de durée
  if (duration < 0) {
    const lbl = this.add.text(hx, hy + 30, "∞", { fontSize: "18px", fill: "#88ffcc" })
      .setOrigin(0.5).setDepth(26);
    powerupHudIcon._label = lbl;
  } else if (duration > 0) {
    // Fond barre
    const barBg = this.add.graphics().setDepth(25);
    barBg.fillStyle(0x333333, 0.8);
    barBg.fillRoundedRect(hx - 28, hy + 26, 56, 8, 3);
    powerupHudIcon._barBg = barBg;

    powerupHudBar = this.add.graphics().setDepth(26);
    // Parser la couleur hex manuellement
    const hexStr = color.replace('#', '');
    const barColor = parseInt(hexStr, 16);

    const barTween = { val: 1 };
    this.tweens.add({
      targets: barTween, val: 0, duration: duration,
      onUpdate: () => {
        if (!powerupHudBar) return;
        powerupHudBar.clear();
        powerupHudBar.fillStyle(barColor, 1);
        powerupHudBar.fillRoundedRect(hx - 28, hy + 26, 56 * barTween.val, 8, 3);
      },
      onComplete: () => {
        if (powerupHudBar) { powerupHudBar.destroy(); powerupHudBar = null; }
        barBg.destroy();
      }
    });
  }

  // Petit pulse
  this.tweens.add({ targets: eText, scaleX: 1.1, scaleY: 1.1, duration: 500, yoyo: true, repeat: -1 });
}

function destroyPowerupHUDFull() {
  if (powerupHudIcon) {
    if (powerupHudIcon._eText)  powerupHudIcon._eText.destroy();
    if (powerupHudIcon._barBg)  powerupHudIcon._barBg.destroy();
    if (powerupHudIcon._label)  powerupHudIcon._label.destroy();
    powerupHudIcon.destroy();
    powerupHudIcon = null;
  }
  if (powerupHudBar) { powerupHudBar.destroy(); powerupHudBar = null; }
}

function activateMagnet() {
  clearActivePowerup.call(this);
  activePowerupId = "magnet";
  magnetActive = true;
  if (magnetTimer) magnetTimer.remove();
  magnetTimer = this.time.delayedCall(MAGNET_DURATION, () => {
    magnetActive = false;
    activePowerupId = null;
    clearPowerupHUD.call(this);
  });
  updatePowerupHUD.call(this, "🧲", "#88ddff", MAGNET_DURATION);
}

function activateShield() {
  // Le bouclier est permanent jusqu'au premier coup reçu
  clearActivePowerup.call(this);
  activePowerupId = "shield";
  shieldActive = true;
  if (shieldSprite) shieldSprite.destroy();
  shieldSprite = this.add.image(player.x, player.y, "shield")
    .setScale(0.7).setAlpha(0.7).setDepth(11);
  this.tweens.add({ targets: shieldSprite, angle: 360, duration: 2000, repeat: -1 });
  updatePowerupHUD.call(this, "🛡️", "#88ffcc", -1); // -1 = permanent
}

// ============================================================
//  POWER-UPS : TURBO / FREEZE / BOMB / STAR
// ============================================================
function activateTurbo() {
  clearActivePowerup.call(this);
  activePowerupId = "turbo";
  turboActive = true;
  if (turboTimer) turboTimer.remove();
  turboTimer = this.time.delayedCall(4000, () => {
    turboActive = false; activePowerupId = null; clearPowerupHUD.call(this);
  });
  updatePowerupHUD.call(this, "⚡", "#ffee00", 4000);
}

function activateFreeze() {
  clearActivePowerup.call(this);
  activePowerupId = "freeze";
  freezeActive = true;
  if (freezeTimer) freezeTimer.remove();
  // Les carottes continuent d'avancer mais deviennent bleues et inoffensives
  carrots.children.iterate(c => { if (c && c.active) c.setTint(0x88eeff); });
  freezeTimer = this.time.delayedCall(3000, () => {
    freezeActive = false;
    activePowerupId = null;
    clearPowerupHUD.call(this);
    carrots.children.iterate(c => { if (c && c.active) c.clearTint(); });
  });
  updatePowerupHUD.call(this, "❄️", "#aaeeff", 3000);
}

function activateBomb() {
  clearActivePowerup.call(this);

  // Onde de choc visuelle depuis le joueur
  const cx = player.x;
  const cy = player.y;

  // Cercle d'onde qui s'étend
  const ring = this.add.graphics().setDepth(55);
  const wave = { r: 10 };
  this.tweens.add({
    targets: wave, r: W * 0.9, duration: 500, ease: "Quad.easeOut",
    onUpdate: () => {
      ring.clear();
      ring.lineStyle(6, 0xff6600, 1 - wave.r / (W * 0.9));
      ring.strokeCircle(cx, cy, wave.r);
      ring.lineStyle(3, 0xffcc00, 0.7 * (1 - wave.r / (W * 0.9)));
      ring.strokeCircle(cx, cy, wave.r * 0.85);
    },
    onComplete: () => ring.destroy()
  });

  // Flash blanc bref
  const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.5).setDepth(60);
  this.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() });

  // Détruire UNIQUEMENT les carottes (burgers, donuts et power-ups sont préservés)
  const bombTargets = [];
  carrots.children.iterate(c => { if (c && c.active) bombTargets.push(c); });

  bombTargets.forEach(obj => {
    const dist = Phaser.Math.Distance.Between(cx, cy, obj.x, obj.y);
    const delay = (dist / (W * 0.9)) * 450;
    this.time.delayedCall(delay, () => {
      if (obj.active) {
        spawnHitSparks.call(this, obj.x, obj.y, 0xff4444);
        obj.setActive(false).setVisible(false);
      }
    });
  });

  this.cameras.main.shake(400, 0.025);

  // Texte
  showFloatingPoints.call(this, cx, cy - 60, "💥 BOMBE !", "#ff8800");
}

function activateStar() {
  clearActivePowerup.call(this);
  activePowerupId = "star";
  invincible = true;
  player.setTint(0xFFD700);
  this.time.delayedCall(5000, () => {
    invincible = false;
    player.clearTint();
    activePowerupId = null;
    clearPowerupHUD.call(this);
  });
  updatePowerupHUD.call(this, "⭐", "#ffffaa", 5000);
}

// ============================================================
//  HIT CAROTTE
// ============================================================
function hitCarrot(playerObj, carrot) {
  if (!started || !carrot.active) return;
  if (invincible) { carrot.setActive(false).setVisible(false); return; }
  // Freeze actif : carottes inoffensives, on les détruit juste
  if (freezeActive) { carrot.setActive(false).setVisible(false); return; }
  if (shieldActive) {
    carrot.setActive(false).setVisible(false);
    shieldActive = false;
    activePowerupId = null;
    if (shieldSprite) { shieldSprite.destroy(); shieldSprite = null; }
    destroyPowerupHUDFull.call(this);
    showFloatingPoints.call(this, playerObj.x, playerObj.y - 50, "🛡️ BLOQUÉ!", "#88ffcc");
    this.cameras.main.shake(80, 0.003);
    return;
  }
  carrot.setActive(false).setVisible(false);
  combo = 0; comboMultiplier = 1;
  if (comboText) comboText.setAlpha(0);
  sfxHit.play();
  this.cameras.main.shake(250, 0.012);
  spawnHitSparks.call(this, playerObj.x, playerObj.y, 0xff4444);
  loseLife.call(this);
}

// ============================================================
//  SPARKS
// ============================================================
function spawnHitSparks(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist  = Phaser.Math.Between(30, 70);
    const spark = this.add.circle(x, y, Phaser.Math.Between(3, 7), color).setDepth(25);
    this.tweens.add({ targets: spark, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, scaleX: 0, scaleY: 0, duration: Phaser.Math.Between(200, 400), ease: "Quad.easeOut", onComplete: () => spark.destroy() });
  }
}

// ============================================================
//  COMBO / POINTS FLOTTANTS
// ============================================================
function showComboText(mult) {
  comboText.setText("x" + mult + " COMBO!").setAlpha(1).setScale(1);
  this.tweens.killTweensOf(comboText);
  this.tweens.add({
    targets: comboText,
    scaleX: 1.25, scaleY: 1.25,
    duration: 150, yoyo: true,
    onComplete: () => {
      this.tweens.killTweensOf(comboText);
      this.tweens.add({ targets: comboText, alpha: 0, delay: 800, duration: 400 });
    }
  });
}

function showFloatingPoints(x, y, text, color) {
  const t = this.add.text(x, y, text, { fontSize: "24px", fill: color || "#fff", fontStyle: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(30);
  this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, ease: "Quad.easeOut", onComplete: () => t.destroy() });
}

// ============================================================
//  PERTE DE VIE
// ============================================================
function loseLife() {
  lives--;
  livesText.setText("❤️ Lives: " + lives);
  player.setPosition(200, H / 2).setVelocity(0, 0);
  combo = 0; comboMultiplier = 1;

  // Reset aimant proprement
  if (magnetActive) {
    magnetActive = false;
    if (magnetTimer) { magnetTimer.remove(); magnetTimer = null; }
    // Remettre vélocité normale sur tous les burgers
    burgers.children.iterate(o => {
      if (o && o.active) {
        this.tweens.killTweensOf(o);
        o.setVelocityX(-(BASE_ITEM_SPEED * speedMult));
        o.setVelocityY(0);
      }
    });
  }

  activateInvincibility.call(this);
  if (lives <= 0) triggerGameOver.call(this);
}

function activateInvincibility() {
  if (invincible) return;
  invincible = true;
  if (blinkInterval) clearInterval(blinkInterval);
  blinkInterval = setInterval(() => { player.visible = !player.visible; }, 150);
  if (invincibleTimer) invincibleTimer.remove();
  invincibleTimer = this.time.delayedCall(3000, () => { clearInterval(blinkInterval); player.visible = true; invincible = false; });
}

// ============================================================
//  GAME OVER
// ============================================================
function triggerGameOver() {
  gameOver = true;
  clearObjects();
  updateHighScore.call(this);
  if (bgMusic) { bgMusic.stop(); bgMusic = null; }
  speedLinesGraphics.clear();

  gameOverContainer = this.add.container(W / 2, H / 2).setDepth(40);
  const bg = this.add.graphics();
  bg.fillStyle(0x000000, 0.7);
  bg.fillRoundedRect(-300, -200, 600, 400, 20);
  gameOverContainer.add(bg);
  gameOverContainer.add(this.add.text(0, -140, "GAME OVER", { fontSize: "72px", fill: "#ff3333", fontStyle: "bold", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5));
  gameOverContainer.add(this.add.text(0, -40,  "Score : " + score,    { fontSize: "36px", fill: "#fff",    stroke: "#000", strokeThickness: 3 }).setOrigin(0.5));
  gameOverContainer.add(this.add.text(0,  20,  "🏆 Best : " + highScore, { fontSize: "30px", fill: "#FFD700", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5));

  const restart = this.add.text(0, 110, "Redémarrage dans 5s…", { fontSize: "22px", fill: "#aaa" }).setOrigin(0.5);
  gameOverContainer.add(restart);

  let countdown = 5;
  this.time.addEvent({ delay: 1000, repeat: 4, callback: () => {
    countdown--;
    restart.setText(countdown > 0 ? "Redémarrage dans " + countdown + "s…" : "");
  }});

  this.cameras.main.shake(400, 0.02);
  sfxGameOver.play();
  this.time.delayedCall(5000, () => { resetGame.call(this); });
}

// ============================================================
//  HIGH SCORE
// ============================================================
function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("burgerHeroHigh", highScore);
    highScoreText.setText("🏆 Best: " + highScore);
  }
}

function addToTotalScore(pts) {
  totalScore += pts;
  localStorage.setItem("burgerHeroTotal", totalScore);
  checkPowerupUnlocks.call(this);
}

function checkPowerupUnlocks() {
  POWERUP_DEFS.forEach(def => {
    if (!unlockedPowers.has(def.id) && totalScore >= def.unlock) {
      unlockedPowers.add(def.id);
      localStorage.setItem("burgerHeroUnlocked", JSON.stringify([...unlockedPowers]));
      showUnlockText.call(this, def);
    }
  });
}

function showUnlockText(def) {
  const t = this.add.text(W / 2, H / 2 + 60,
    def.emoji + " " + def.name.toUpperCase() + " DÉBLOQUÉ !", {
    fontSize: "38px", fill: "#FFD700",
    fontStyle: "bold", stroke: "#000", strokeThickness: 5
  }).setOrigin(0.5).setDepth(36);
  this.tweens.add({
    targets: t, y: H / 2 - 20, alpha: 0,
    delay: 1200, duration: 600,
    onComplete: () => t.destroy()
  });
}

// ============================================================
//  CLEAR & RESET
// ============================================================
function clearObjects() {
  burgers.children.iterate(o  => { if (o) o.setActive(false).setVisible(false); });
  carrots.children.iterate(o  => { if (o) o.setActive(false).setVisible(false); });
  powerups.children.iterate(o => {
    if (o && o.active) {
      const m = powerMeta.get(o);
      if (m && m.bubble) { m.bubble.destroy(); m.bubble = null; }
      o.setActive(false).setVisible(false);
    }
  });
  if (comboBubbles) {
    comboBubbles.children.iterate(cb => {
      if (cb && cb.active) {
        const m = powerMeta.get(cb);
        if (m && m.bubble) { m.bubble.destroy(); m.bubble = null; }
        if (m && m.label)  { m.label.destroy();  m.label  = null; }
        cb.setActive(false).setVisible(false);
      }
    });
  }
}

function resetGame() {
  clearObjects();
  if (bgMusic) { bgMusic.stop(); bgMusic = null; }

  score = 0; lives = 3; difficulty = 3; nextLifeScore = 10000;
  combo = 0; comboMultiplier = 1;
  magnetActive = false; shieldActive = false;
  if (shieldSprite) { shieldSprite.destroy(); shieldSprite = null; }

  // Reset paliers
  currentTier = 0; speedMult = 1.0; spawnDelay = BASE_SPAWN_DELAY;
  if (spawnTimer) { spawnTimer.delay = BASE_SPAWN_DELAY; }
  if (tileMountains)  tileMountains.speed  = BASE_SPEED_MOUNTAINS;
  if (tileCloudsFar)  tileCloudsFar.speed  = BASE_SPEED_CLOUDS_FAR;
  if (tileCloudsNear) tileCloudsNear.speed = BASE_SPEED_CLOUDS_NEAR;
  speedLinesGraphics.clear();

  scoreText.setText("Score: 0");
  livesText.setText("❤️ Lives: 3");
  comboText.setAlpha(0);
  if (gameOverContainer) gameOverContainer.destroy();

  started = false; gameOver = false; invincible = false; tierTextActive = false;
  turboActive = false; freezeActive = false;
  if (turboTimer)  { turboTimer.remove();  turboTimer = null; }
  if (freezeTimer) { freezeTimer.remove(); freezeTimer = null; }
  activePowerupId = null;
  destroyPowerupHUDFull.call(this);
  player.clearTint();
  resetBoss.call(this);
  joyLeft = joyRight = joyUp = joyDown = joyActive = false;
  joyThumb.setPosition(JOY_X, H - JOY_Y_OFFSET);

  if (blinkInterval) clearInterval(blinkInterval);
  player.visible = true;
  player.body.allowGravity = false;
  player.setVelocity(0, 0);
  player.setPosition(200, H / 2);
  document.body.style.cursor = "default";

  buildStartScreen.call(this);
}

// ============================================================
//  PAUSE
// ============================================================
function togglePause() {
  paused = !paused;
  if (paused) {
    this.physics.pause();
    spawnTimer.paused = true;
    document.body.style.cursor = "default";
    if (bgMusic) bgMusic.setVolume(0.25);
    buildPauseMenu.call(this);
  } else {
    this.physics.resume();
    spawnTimer.paused = false;
    document.body.style.cursor = "none";
    if (bgMusic) bgMusic.setVolume(0.5);
    if (pauseMenuContainer) { pauseMenuContainer.destroy(); pauseMenuContainer = null; }
  }
}

function buildPauseMenu() {
  if (pauseMenuContainer) pauseMenuContainer.destroy();
  pauseMenuContainer = this.add.container(W / 2, H / 2).setDepth(50);

  // Fond
  const bg = this.add.graphics();
  bg.fillStyle(0x000000, 0.75);
  bg.fillRoundedRect(-320, -280, 640, 560, 20);
  pauseMenuContainer.add(bg);

  // Titre
  pauseMenuContainer.add(this.add.text(0, -240, "⏸ PAUSE", {
    fontSize: "52px", fill: "#fff", fontStyle: "bold", stroke: "#000", strokeThickness: 5
  }).setOrigin(0.5));

  // Score total
  pauseMenuContainer.add(this.add.text(0, -175, "Points cumulés : " + totalScore, {
    fontSize: "22px", fill: "#ffe066"
  }).setOrigin(0.5));

  // Titre collection
  pauseMenuContainer.add(this.add.text(-280, -130, "COLLECTION POWER-UPS", {
    fontSize: "18px", fill: "#aaeeff", fontStyle: "bold"
  }));

  // Grille power-ups (3 par ligne)
  POWERUP_DEFS.forEach((def, i) => {
    const col     = i % 3;
    const row     = Math.floor(i / 3);
    const x       = -200 + col * 200;
    const y       = -95  + row * 130;
    const unlocked = unlockedPowers.has(def.id);

    // Fond carte
    const card = this.add.graphics();
    card.fillStyle(unlocked ? 0x1a3a1a : 0x222222, 1);
    card.lineStyle(2, unlocked ? 0x44ff88 : 0x555555, 1);
    card.fillRoundedRect(x - 85, y - 10, 170, 110, 10);
    card.strokeRoundedRect(x - 85, y - 10, 170, 110, 10);
    pauseMenuContainer.add(card);

    // Image PNG (même asset qu'in-game) ou emoji fallback
    if (this.textures.exists(def.id)) {
      const img = this.add.image(x, y + 28, def.id)
        .setDisplaySize(40, 40).setAlpha(unlocked ? 1 : 0.3).setDepth(51);
      pauseMenuContainer.add(img);
    } else {
      pauseMenuContainer.add(this.add.text(x, y + 12, def.emoji, {
        fontSize: "34px"
      }).setOrigin(0.5).setAlpha(unlocked ? 1 : 0.3));
    }

    // Nom
    pauseMenuContainer.add(this.add.text(x, y + 52, def.name, {
      fontSize: "16px", fill: unlocked ? "#ffffff" : "#666666", fontStyle: "bold"
    }).setOrigin(0.5));

    // Condition ou statut
    const condText = unlocked
      ? "✅ Débloqué"
      : "🔒 " + def.unlock.toLocaleString() + " pts";
    pauseMenuContainer.add(this.add.text(x, y + 74, condText, {
      fontSize: "13px", fill: unlocked ? "#44ff88" : "#888888"
    }).setOrigin(0.5));
  });

  // ── Boutons d'action ──────────────────────────────────────
  const btnData = [
    { label: "▶ REPRENDRE",    y: 210, col: "#aaffaa", action: "resume" },
    { label: "🔄 RECOMMENCER", y: 255, col: "#ffeeaa", action: "restart" },
    { label: "✖ QUITTER",      y: 300, col: "#ffaaaa", action: "quit" },
  ];

  btnData.forEach(btn => {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(-130, btn.y - 18, 260, 36, 8);
    pauseMenuContainer.add(bg);

    const txt = this.add.text(0, btn.y, btn.label, {
      fontSize: "20px", fill: btn.col, fontStyle: "bold"
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });

    txt.on("pointerover",  () => txt.setAlpha(0.7));
    txt.on("pointerout",   () => txt.setAlpha(1));
    txt.on("pointerdown",  () => {
      if (btn.action === "resume") {
        togglePause.call(this);
      } else if (btn.action === "restart") {
        paused = false;
        if (pauseMenuContainer) { pauseMenuContainer.destroy(); pauseMenuContainer = null; }
        resetGame.call(this);
      } else if (btn.action === "quit") {
        paused = false;
        if (pauseMenuContainer) { pauseMenuContainer.destroy(); pauseMenuContainer = null; }
        resetGame.call(this);
      }
    });
    pauseMenuContainer.add(txt);
  });

  pauseMenuContainer.add(this.add.text(0, 345, "P = reprendre",  {
    fontSize: "14px", fill: "#666666"
  }).setOrigin(0.5));
}

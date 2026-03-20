/**
 * GenCharacter
 *
 * Canvas 2D renderer for Gen character.
 * Handles all visual rendering including body, eyes, mouth, quill, and particles.
 * Supports OffscreenCanvas for Web Worker rendering.
 */

import {
  type AnimationState,
  type LipSyncData,
  type Realm,
  GEN_COLORS,
  REALM_COLORS,
  EXPRESSION_PRESETS,
} from '../types';

export interface GenCharacterConfig {
  /** Canvas element (HTMLCanvasElement or OffscreenCanvas) */
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Initial realm for color theming */
  realm?: Realm;
  /** Enable particle effects (default: true) */
  enableParticles?: boolean;
  /** Enable soft-body physics (default: true) */
  enablePhysics?: boolean;
  /** Device pixel ratio (default: 1) */
  pixelRatio?: number;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
}

interface EyeState {
  openness: number;
  lookX: number;
  lookY: number;
  pupilSize: number;
}

interface MouthState {
  openness: number;
  width: number;
  shape: string;
}

interface BodyPhysics {
  velocity: { x: number; y: number };
  squash: number;
  rotation: number;
  wobble: number;
  wobblePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number];
  type: 'sparkle' | 'star' | 'trail';
}

export class GenCharacter {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private readonly config: Required<GenCharacterConfig>;

  private animationState: AnimationState = 'idle';
  private blendWeight = 1;
  private lipSync: LipSyncData = { mouthOpenness: 0, jawPosition: 0, lipTension: 0 };
  private realm: Realm = 'kingdom';
  private position = { x: 0.5, y: 0.5 };
  private scale = 1;

  private eyeState: EyeState = { openness: 1, lookX: 0, lookY: 0, pupilSize: 1 };
  private mouthState: MouthState = { openness: 0, width: 1, shape: 'neutral' };
  private targetEyeState: EyeState = { ...this.eyeState };
  private targetMouthState: MouthState = { ...this.mouthState };

  private bodyPhysics: BodyPhysics = {
    velocity: { x: 0, y: 0 },
    squash: 1,
    rotation: 0,
    wobble: 0,
    wobblePhase: 0,
  };

  private particles: Particle[] = [];
  private lastTime = 0;
  private blinkTimer = 0;
  private nextBlinkTime = 3000;

  constructor(config: GenCharacterConfig) {
    this.canvas = config.canvas;
    this.config = {
      canvas: config.canvas,
      realm: config.realm ?? 'kingdom',
      enableParticles: config.enableParticles ?? true,
      enablePhysics: config.enablePhysics ?? true,
      pixelRatio: config.pixelRatio ?? 1,
      width: config.width,
      height: config.height,
    };
    this.realm = this.config.realm;
  }

  /**
   * Initialize the renderer.
   */
  async initialize(): Promise<void> {
    this.ctx = this.canvas.getContext('2d', { alpha: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (!this.ctx) {
      throw new Error('[GenCharacter] Failed to get 2D context');
    }

    this.resize(this.config.width, this.config.height);
  }

  /**
   * Resize the canvas.
   */
  resize(width: number, height: number): void {
    const pr = this.config.pixelRatio;
    this.canvas.width = width * pr;
    this.canvas.height = height * pr;
    if (this.ctx) {
      this.ctx.scale(pr, pr);
    }
  }

  /**
   * Start the render loop.
   */
  start(): void {
    if (this.animationFrameId === null) {
      this.lastTime = performance.now();
      this.render();
    }
  }

  /**
   * Stop the render loop.
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set animation state.
   */
  setAnimationState(state: AnimationState, blendWeight = 1): void {
    this.animationState = state;
    this.blendWeight = blendWeight;

    const preset = EXPRESSION_PRESETS[state];
    this.targetEyeState = { ...this.eyeState, ...preset.eye };
    this.targetMouthState = { ...this.mouthState, ...preset.mouth };
  }

  /**
   * Update lip sync data.
   */
  setLipSync(data: LipSyncData): void {
    this.lipSync = data;
    if (this.animationState === 'speaking') {
      this.targetMouthState.openness = data.mouthOpenness;
    }
  }

  /**
   * Set realm for color theming.
   */
  setRealm(realm: Realm): void {
    this.realm = realm;
  }

  /**
   * Set position (normalized 0-1).
   */
  setPosition(x: number, y: number): void {
    const dx = x - this.position.x;
    const dy = y - this.position.y;

    this.bodyPhysics.velocity.x += dx * 2;
    this.bodyPhysics.velocity.y += dy * 2;
    this.position = { x, y };
  }

  /**
   * Render a single frame (for worker use).
   */
  renderFrame(): void {
    const now = performance.now();
    const deltaTime = Math.min(now - this.lastTime, 100);
    this.lastTime = now;

    this.update(deltaTime);
    this.draw();
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stop();
    this.ctx = null;
  }

  private render = (): void => {
    this.renderFrame();
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private update(deltaTime: number): void {
    const dt = deltaTime / 1000;
    this.updateBlink(deltaTime);
    this.interpolateExpressions(dt);

    if (this.config.enablePhysics) {
      this.updatePhysics(dt);
    }

    if (this.config.enableParticles) {
      this.updateParticles(dt);
    }
  }

  private updateBlink(deltaTime: number): void {
    this.blinkTimer += deltaTime;

    if (this.blinkTimer >= this.nextBlinkTime) {
      this.targetEyeState.openness = 0.1;

      setTimeout(() => {
        const preset = EXPRESSION_PRESETS[this.animationState];
        this.targetEyeState.openness = preset.eye.openness ?? 1;
      }, 100);

      this.blinkTimer = 0;
      this.nextBlinkTime = 2000 + Math.random() * 4000;
    }
  }

  private interpolateExpressions(dt: number): void {
    const lerpFactor = 8 * dt;

    this.eyeState.openness += (this.targetEyeState.openness - this.eyeState.openness) * lerpFactor;
    this.eyeState.lookX += (this.targetEyeState.lookX - this.eyeState.lookX) * lerpFactor;
    this.eyeState.lookY += (this.targetEyeState.lookY - this.eyeState.lookY) * lerpFactor;
    this.eyeState.pupilSize += (this.targetEyeState.pupilSize - this.eyeState.pupilSize) * lerpFactor;

    let targetOpenness = this.targetMouthState.openness;
    if (this.animationState === 'speaking') {
      targetOpenness = this.lipSync.mouthOpenness;
    }

    this.mouthState.openness += (targetOpenness - this.mouthState.openness) * lerpFactor;
    this.mouthState.width += (this.targetMouthState.width - this.mouthState.width) * lerpFactor;
  }

  private updatePhysics(dt: number): void {
    const physics = this.bodyPhysics;

    // Damping
    physics.velocity.x *= 0.95;
    physics.velocity.y *= 0.95;

    // Wobble from velocity
    const speed = Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2);
    physics.wobble = Math.min(speed * 0.5, 0.1);
    physics.wobblePhase += dt * 12;

    // Squash from vertical velocity
    const targetSquash = 1 + physics.velocity.y * 0.3;
    physics.squash += (targetSquash - physics.squash) * 5 * dt;

    // Gentle rotation
    physics.rotation = Math.sin(performance.now() / 2000) * 0.05;
  }

  private updateParticles(dt: number): void {
    // Spawn new particles
    if (Math.random() < 0.1) {
      this.spawnParticle();
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 0.5 * dt; // Gravity
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Cap particle count
    while (this.particles.length > 50) {
      this.particles.shift();
    }
  }

  private spawnParticle(): void {
    const types: Particle['type'][] = ['sparkle', 'star', 'trail'];
    const colors = [GEN_COLORS.sparkleGold, GEN_COLORS.sparkleCyan, GEN_COLORS.sparkleWhite];

    this.particles.push({
      x: 0.65 + Math.random() * 0.15,
      y: 0.3 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: Math.random() * 0.2 - 0.1,
      life: 1 + Math.random() * 2,
      maxLife: 2,
      size: 2 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: types[Math.floor(Math.random() * types.length)],
    });
  }

  private draw(): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvas.width / this.config.pixelRatio;
    const h = this.canvas.height / this.config.pixelRatio;

    ctx.clearRect(0, 0, w, h);

    const centerX = w * this.position.x;
    const centerY = h * this.position.y;
    const size = Math.min(w, h) * 0.4 * this.scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.bodyPhysics.rotation);

    const squash = this.bodyPhysics.squash;
    ctx.scale(1 + (1 - squash) * 0.3, squash);

    this.drawGlow(ctx, size);
    this.drawBody(ctx, size);
    this.drawEyes(ctx, size);
    this.drawMouth(ctx, size);
    this.drawQuill(ctx, size);

    ctx.restore();

    this.drawParticles(ctx, w, h);
  }

  private drawGlow(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, size: number): void {
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 1.2);
    const realm = REALM_COLORS[this.realm];

    gradient.addColorStop(0, `rgba(${realm[0] * 255}, ${realm[1] * 255}, ${realm[2] * 255}, 0.3)`);
    gradient.addColorStop(
      0.5,
      `rgba(${GEN_COLORS.bodyGlow[0] * 255}, ${GEN_COLORS.bodyGlow[1] * 255}, ${GEN_COLORS.bodyGlow[2] * 255}, 0.15)`
    );
    gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.2, size * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBody(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, size: number): void {
    const realm = REALM_COLORS[this.realm];
    const wobble = Math.sin(this.bodyPhysics.wobblePhase) * this.bodyPhysics.wobble * size;

    const gradient = ctx.createRadialGradient(-size * 0.2, -size * 0.3, 0, 0, 0, size);

    const r = (GEN_COLORS.bodyPrimary[0] * 0.7 + realm[0] * 0.3) * 255;
    const g = (GEN_COLORS.bodyPrimary[1] * 0.7 + realm[1] * 0.3) * 255;
    const b = (GEN_COLORS.bodyPrimary[2] * 0.7 + realm[2] * 0.3) * 255;

    gradient.addColorStop(0, `rgba(${r + 40}, ${g + 40}, ${b + 40}, 0.95)`);
    gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.9)`);
    gradient.addColorStop(0.8, `rgba(${r - 20}, ${g - 20}, ${b}, 0.85)`);
    gradient.addColorStop(1, `rgba(${r - 40}, ${g - 40}, ${b}, 0.7)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.7);
    ctx.bezierCurveTo(size * 0.6 + wobble, -size * 0.6, size * 0.7, -size * 0.1, size * 0.5 + wobble * 0.5, size * 0.3);
    ctx.bezierCurveTo(size * 0.4, size * 0.5, size * 0.2 + wobble, size * 0.6, 0, size * 0.5);
    ctx.bezierCurveTo(-size * 0.2 - wobble, size * 0.6, -size * 0.4, size * 0.5, -size * 0.5 - wobble * 0.5, size * 0.3);
    ctx.bezierCurveTo(-size * 0.7, -size * 0.1, -size * 0.6 - wobble, -size * 0.6, 0, -size * 0.7);
    ctx.closePath();
    ctx.fill();

    // Highlight
    const highlight = ctx.createRadialGradient(-size * 0.15, -size * 0.4, 0, -size * 0.1, -size * 0.3, size * 0.5);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fill();
  }

  private drawEyes(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, size: number): void {
    const eyeY = -size * 0.15;
    const eyeSpacing = size * 0.22;
    const eyeRadius = size * 0.18 * this.eyeState.openness;

    for (const side of [-1, 1]) {
      const eyeX = eyeSpacing * side;
      const lookOffset = {
        x: this.eyeState.lookX * eyeRadius * 0.15,
        y: this.eyeState.lookY * eyeRadius * 0.1,
      };

      // Eye white
      const eyeGradient = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, eyeRadius * 1.2);
      eyeGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      eyeGradient.addColorStop(0.7, 'rgba(230, 245, 255, 1)');
      eyeGradient.addColorStop(1, 'rgba(200, 230, 250, 0.8)');

      ctx.fillStyle = eyeGradient;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeRadius, eyeRadius * this.eyeState.openness, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      const irisRadius = eyeRadius * 0.6 * this.eyeState.pupilSize;
      const irisGradient = ctx.createRadialGradient(
        eyeX + lookOffset.x,
        eyeY + lookOffset.y,
        0,
        eyeX + lookOffset.x,
        eyeY + lookOffset.y,
        irisRadius
      );
      irisGradient.addColorStop(0, `rgb(${GEN_COLORS.eyeIris[0] * 255}, ${GEN_COLORS.eyeIris[1] * 255}, ${GEN_COLORS.eyeIris[2] * 255})`);
      irisGradient.addColorStop(0.7, `rgb(${GEN_COLORS.eyeIris[0] * 200}, ${GEN_COLORS.eyeIris[1] * 200}, ${GEN_COLORS.eyeIris[2] * 200})`);
      irisGradient.addColorStop(1, `rgba(${GEN_COLORS.eyeIris[0] * 150}, ${GEN_COLORS.eyeIris[1] * 180}, ${GEN_COLORS.eyeIris[2] * 180}, 0.8)`);

      ctx.fillStyle = irisGradient;
      ctx.beginPath();
      ctx.ellipse(eyeX + lookOffset.x, eyeY + lookOffset.y, irisRadius, irisRadius * this.eyeState.openness, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      const pupilRadius = irisRadius * 0.4;
      ctx.fillStyle = `rgb(${GEN_COLORS.eyePupil[0] * 255}, ${GEN_COLORS.eyePupil[1] * 255}, ${GEN_COLORS.eyePupil[2] * 255})`;
      ctx.beginPath();
      ctx.ellipse(eyeX + lookOffset.x, eyeY + lookOffset.y, pupilRadius, pupilRadius * this.eyeState.openness, 0, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(eyeX + lookOffset.x - eyeRadius * 0.2, eyeY + lookOffset.y - eyeRadius * 0.2, eyeRadius * 0.15, eyeRadius * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMouth(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, size: number): void {
    const mouthY = size * 0.15;
    const mouthWidth = size * 0.15 * this.mouthState.width;
    const mouthHeight = size * 0.08 * this.mouthState.openness;

    if (mouthHeight < 1) {
      // Closed mouth - just a line
      ctx.strokeStyle = `rgba(${GEN_COLORS.mouthInner[0] * 255}, ${GEN_COLORS.mouthInner[1] * 255}, ${GEN_COLORS.mouthInner[2] * 255}, 0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-mouthWidth, mouthY);
      ctx.quadraticCurveTo(0, mouthY + size * 0.03 * this.mouthState.width, mouthWidth, mouthY);
      ctx.stroke();
      return;
    }

    // Open mouth
    const mouthGradient = ctx.createRadialGradient(0, mouthY, 0, 0, mouthY, mouthHeight * 1.5);
    mouthGradient.addColorStop(0, `rgb(${GEN_COLORS.mouthInner[0] * 200}, ${GEN_COLORS.mouthInner[1] * 150}, ${GEN_COLORS.mouthInner[2] * 200})`);
    mouthGradient.addColorStop(1, `rgb(${GEN_COLORS.mouthInner[0] * 100}, ${GEN_COLORS.mouthInner[1] * 80}, ${GEN_COLORS.mouthInner[2] * 100})`);

    ctx.fillStyle = mouthGradient;
    ctx.beginPath();

    if (this.mouthState.shape === 'o') {
      ctx.ellipse(0, mouthY, mouthWidth * 0.6, mouthHeight, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, mouthY, mouthWidth, mouthHeight, 0, 0, Math.PI * 2);
    }

    ctx.fill();
  }

  private drawQuill(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, size: number): void {
    const quillX = size * 0.45;
    const quillY = -size * 0.1;
    const quillLength = size * 0.6;
    const quillAngle = -Math.PI / 4 + Math.sin(performance.now() / 800) * 0.1;

    ctx.save();
    ctx.translate(quillX, quillY);
    ctx.rotate(quillAngle);

    // Shaft
    ctx.strokeStyle = `rgb(${GEN_COLORS.quillFeather[0] * 255}, ${GEN_COLORS.quillFeather[1] * 255}, ${GEN_COLORS.quillFeather[2] * 255})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -quillLength);
    ctx.stroke();

    // Barbs
    const barbCount = 8;
    for (let i = 0; i < barbCount; i++) {
      const t = (i + 1) / (barbCount + 1);
      const y = -quillLength * t * 0.9;
      const barbLength = size * 0.15 * (1 - Math.abs(t - 0.5) * 1.5);

      ctx.strokeStyle = `rgba(${GEN_COLORS.quillFeather[0] * 255}, ${GEN_COLORS.quillFeather[1] * 255}, ${GEN_COLORS.quillFeather[2] * 255}, 0.8)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(barbLength, y - size * 0.05);
      ctx.moveTo(0, y);
      ctx.lineTo(-barbLength, y - size * 0.05);
      ctx.stroke();
    }

    // Nib
    const nibGradient = ctx.createLinearGradient(0, 0, 0, size * 0.12);
    nibGradient.addColorStop(0, `rgb(${GEN_COLORS.quillTip[0] * 255}, ${GEN_COLORS.quillTip[1] * 255}, ${GEN_COLORS.quillTip[2] * 255})`);
    nibGradient.addColorStop(1, `rgb(${GEN_COLORS.quillTip[0] * 200}, ${GEN_COLORS.quillTip[1] * 150}, ${GEN_COLORS.quillTip[2] * 50})`);

    ctx.fillStyle = nibGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, size * 0.05);
    ctx.lineTo(0, size * 0.12);
    ctx.lineTo(4, size * 0.05);
    ctx.closePath();
    ctx.fill();

    // Nib glow
    const glowGradient = ctx.createRadialGradient(0, size * 0.06, 0, 0, size * 0.06, size * 0.1);
    glowGradient.addColorStop(0, 'rgba(255, 220, 100, 0.6)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, size * 0.06, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const x = p.x * w;
      const y = p.y * h;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'sparkle') {
        ctx.fillStyle = `rgb(${p.color[0] * 255}, ${p.color[1] * 255}, ${p.color[2] * 255})`;
        ctx.beginPath();

        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + performance.now() / 500;
          const innerRadius = p.size * 0.3;
          const outerRadius = p.size;

          ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
          ctx.lineTo(x + Math.cos(angle + Math.PI / 4) * innerRadius, y + Math.sin(angle + Math.PI / 4) * innerRadius);
        }

        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'star') {
        ctx.fillStyle = `rgba(${p.color[0] * 255}, ${p.color[1] * 255}, ${p.color[2] * 255}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size);
        gradient.addColorStop(0, `rgba(${p.color[0] * 255}, ${p.color[1] * 255}, ${p.color[2] * 255}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${p.color[0] * 255}, ${p.color[1] * 255}, ${p.color[2] * 255}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

export function createGenCharacter(config: GenCharacterConfig): GenCharacter {
  return new GenCharacter(config);
}

export type SkeletalAnimationState =
  | 'idle'
  | 'run'
  | 'attack'
  | 'cast-q'
  | 'cast-w'
  | 'cast-e'
  | 'cast-r'
  | 'hit'
  | 'stun'
  | 'death'
  | 'recall';

export interface SkeletalSkinSelection {
  skinId: string | null;
  attachments?: Record<string, string>;
}

export interface SkeletalAnimationDriver {
  readonly kind: 'sprite-sheet' | 'spine';
  setState(state: SkeletalAnimationState, mixMs?: number): void;
  setSkin(selection: SkeletalSkinSelection): void;
  setTimeScale(scale: number): void;
  update(deltaMs: number): void;
  destroy(): void;
}

/**
 * Stable bridge for a future spine-pixi-v8 adapter.
 * The game can keep the current sprite-sheet renderer until a licensed Spine
 * content pipeline is selected; visual state names and skin semantics remain
 * identical across drivers.
 */
export interface SkeletalDriverFactory {
  supports(heroId: string): boolean;
  create(heroId: string): SkeletalAnimationDriver;
}

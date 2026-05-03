// Type declarations for optional Gen dependencies.
// These packages are only installed when their corresponding layers are activated.
// Layer 1: lottie-react (Lottie animation)
// Layer 2: @rive-app/react-canvas (Rive state machine)

declare module 'lottie-react' {
  import type { ComponentType } from 'react';

  interface LottieProps {
    animationData: object;
    loop?: boolean;
    autoplay?: boolean;
    style?: React.CSSProperties;
    className?: string;
  }

  const Lottie: ComponentType<LottieProps>;
  export default Lottie;
}

declare module '@rive-app/react-canvas' {
  export function useRive(options: { src: string; stateMachines?: string; autoplay?: boolean }): {
    rive: any;
    RiveComponent: React.ComponentType<{ style?: React.CSSProperties }>;
  };

  export function useStateMachineInput(
    rive: any,
    stateMachine: string,
    inputName: string
  ): { value: any } | null;
}

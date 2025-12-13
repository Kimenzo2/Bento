/// <reference types="vitest/globals" />
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

/**
 * Custom render function that wraps components with providers
 * Add your app providers here (Theme, Auth, i18n, etc.)
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Record<string, unknown>;
}

const AllProviders = ({ children }: { children: ReactNode }) => {
  // Add your providers here, e.g.:
  // <ThemeProvider>
  //   <AuthProvider>
  //     <I18nProvider>
  //       {children}
  //     </I18nProvider>
  //   </AuthProvider>
  // </ThemeProvider>
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
): ReturnType<typeof render> => {
  return render(ui, { wrapper: AllProviders, ...options });
};

export * from '@testing-library/react';
export { customRender as render };

/**
 * Wait for async operations to complete
 */
export const waitForAsync = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock function with proper typing
 */
export const createMockFn = <T extends (...args: unknown[]) => unknown>(
  implementation?: T
) => vi.fn(implementation);

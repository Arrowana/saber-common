import React, { ReactNode } from "react";
import { createContainer } from "unstated-next";

import {
  ConnectionContext,
  UseConnectionArgs,
  useConnectionInternal,
} from "./utils/useConnectionInternal";
import {
  UseWalletArgs,
  useWalletInternal,
  WalletContext,
} from "./utils/useWalletInternal";

export interface UseSolana<T extends boolean = boolean>
  extends ConnectionContext,
    WalletContext<T> {}

/**
 * Arguments for constructing a new Solana context.
 *
 * Note: ensure that callbacks are either wrapped in `useCallback` or defined statically,
 * otherwise the page will re-render extremely frequently.
 */
export interface UseSolanaArgs extends UseConnectionArgs, UseWalletArgs {}

/**
 * Provides Solana.
 * @returns
 */
const useSolanaInternal = ({
  onConnect,
  onDisconnect,
  ...connectionArgs
}: UseSolanaArgs = {}): UseSolana => {
  const connectionCtx = useConnectionInternal(connectionArgs);
  const { network, endpoint } = connectionCtx;
  const walletCtx = useWalletInternal({
    onConnect,
    onDisconnect,
    network,
    endpoint,
  });

  return {
    ...walletCtx,
    ...connectionCtx,
  };
};

const Solana = createContainer(useSolanaInternal);

type ProviderProps = UseSolanaArgs & { children: ReactNode };

/**
 * Provides a Solana SDK.
 * Note: ensure that `onConnect` and `onDisconnect` are wrapped in useCallback or are
 * statically defined, otherwise the wallet will keep re-rendering.
 * @returns
 */
export const SolanaProvider: React.FC<ProviderProps> = ({
  children,
  ...args
}: ProviderProps) => (
  <Solana.Provider initialState={args}>{children}</Solana.Provider>
);

/**
 * Fetches the loaded Solana SDK.
 */
export const useSolana = Solana.useContainer;

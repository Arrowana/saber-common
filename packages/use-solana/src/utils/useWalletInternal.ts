import { Network } from "@saberhq/solana";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConnectedWallet, WalletAdapter } from "../adapters/types";
import { WALLET_PROVIDERS, WalletProviderInfo, WalletType } from "../providers";
import { useLocalStorageState } from "./useLocalStorageState";
import { usePrevious } from "./usePrevious";

/**
 * Context for wallet-related variables.
 */
export interface WalletContext<T extends boolean = boolean> {
  /**
   * The wallet connected.
   */
  wallet?: WalletAdapter<T>;
  /**
   * Public key of the connected wallet.
   */
  publicKey?: PublicKey;
  /**
   * Information about the provider of the chosen wallet.
   */
  provider?: WalletProviderInfo;
  /**
   * If true, this wallet is connected.
   */
  connected: T;
  /**
   * Attempts to connect to a wallet with the given WalletType.
   */
  activate: (walletType: WalletType) => Promise<void>;
}

const DEFAULT_AUTOCONNECT_ERROR_HANDLER = (
  error: Error,
  _wallet: WalletAdapter,
  provider: WalletProviderInfo
) => {
  console.warn(
    `Error attempting to automatically connect to ${provider.name}`,
    error
  );
};

export interface UseWalletArgs {
  /**
   * Callback triggered when a wallet is connected.
   */
  onConnect?: (
    wallet: WalletAdapter<true>,
    provider: WalletProviderInfo
  ) => void;

  /**
   * Callback triggered when a wallet is disconnected.
   */
  onDisconnect?: (
    wallet: WalletAdapter<false>,
    provider: WalletProviderInfo
  ) => void;

  /**
   * Automatically attempt to connect to the wallet on the initial page load. Defaults to false.
   */
  autoconnectOnInitialLoad?: boolean;

  /**
   * Automatically attempt to reconnect to the wallet after a network change. Defaults to false.
   */
  reconnectOnNetworkChange?: boolean;

  /**
   * Connects eagerly to a provider if the provider supports it. Defaults to true.
   */
  eagerlyConnect?: boolean;

  /**
   * Callback triggered whenever a wallet cannot automatically connect.
   */
  onAutoconnectError?: (
    error: Error,
    wallet: WalletAdapter,
    provider: WalletProviderInfo
  ) => void;
}

interface UseWalletArgsInternal extends UseWalletArgs {
  /**
   * (internal) The network to connect to.
   */
  network: Network;

  /**
   * (internal) The endpoint of the wallet to connect to.
   */
  endpoint: string;
}

export const useWalletInternal = ({
  onConnect,
  onDisconnect,
  network,
  endpoint,
  autoconnectOnInitialLoad = false,
  reconnectOnNetworkChange = false,
  eagerlyConnect = true,
  onAutoconnectError = DEFAULT_AUTOCONNECT_ERROR_HANDLER,
}: UseWalletArgsInternal): WalletContext<boolean> => {
  const [walletTypeString, setWalletTypeString] = useLocalStorageState<
    string | null
  >("use-solana/wallet-type", null);
  const walletType =
    walletTypeString && walletTypeString in WalletType
      ? (walletTypeString as WalletType)
      : null;

  const [connected, setConnected] = useState(false);

  const [provider, wallet]:
    | readonly [WalletProviderInfo, WalletAdapter]
    | readonly [undefined, undefined] = useMemo(() => {
    if (walletType) {
      const provider = WALLET_PROVIDERS[walletType];
      console.log(`Switched to new wallet for provider ${provider.name}`, {
        provider,
        network,
        endpoint,
      });
      return [provider, new provider.makeAdapter(provider.url, endpoint)];
    }
    return [undefined, undefined];
  }, [walletType, network, endpoint]);

  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const previous = usePrevious({ network });

  useEffect(() => {
    if (!reconnectOnNetworkChange) {
      wallet?.disconnect();
    }
  }, [network, reconnectOnNetworkChange, wallet]);

  useEffect(() => {
    setIsInitialLoad(false);

    if (wallet && provider) {
      // don't do anything if we won't reconnect on network change
      if (!reconnectOnNetworkChange && previous?.network !== network) {
        return;
      }

      const canEagerlyConnect = provider.canEagerlyConnect && eagerlyConnect;
      if (
        isInitialLoad &&
        // if we are on the initial load and can't eagerly connect, don't do anything
        (!canEagerlyConnect ||
          // don't do anything if it's the initial load and we don't want to autoconnect
          !autoconnectOnInitialLoad)
      ) {
        return;
      }

      // only eagerly connect if the provider supports it
      const doEager = isInitialLoad && canEagerlyConnect;
      const timeout = setTimeout(() => {
        void wallet
          .connect({ eager: doEager })
          .catch((e) => onAutoconnectError(e as Error, wallet, provider));
      }, 500);
      return () => clearTimeout(timeout);
    }

    // disabled lint for previous network b/c it comes from a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wallet,
    provider,
    onAutoconnectError,
    network,
    reconnectOnNetworkChange,
    autoconnectOnInitialLoad,
    isInitialLoad,
    eagerlyConnect,
  ]);

  useEffect(() => {
    if (wallet && provider) {
      wallet.on("connect", () => {
        if (wallet?.publicKey) {
          setConnected(true);
          onConnect?.(wallet as ConnectedWallet, provider);
        }
      });

      wallet.on("disconnect", () => {
        setConnected(false);
        onDisconnect?.(wallet as WalletAdapter<false>, provider);
      });
    }

    return () => {
      if (wallet && wallet.connected) {
        void wallet.disconnect();
      }
    };
  }, [onConnect, onDisconnect, provider, wallet]);

  const activate = useCallback(
    async (nextWalletType: WalletType): Promise<void> => {
      if (walletType === nextWalletType) {
        // reconnect
        await wallet?.connect();
      }
      setWalletTypeString(nextWalletType);
    },
    [setWalletTypeString, wallet, walletType]
  );

  return {
    wallet,
    provider,
    connected,
    publicKey: wallet?.publicKey ?? undefined,
    activate,
  };
};

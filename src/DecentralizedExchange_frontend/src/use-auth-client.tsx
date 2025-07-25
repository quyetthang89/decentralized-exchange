import { AuthClient } from "@dfinity/auth-client";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { DecentralizedExchange_backend } from "../../declarations/DecentralizedExchange_backend";
import { token_a } from "../../declarations/token_a";
import { token_b } from "../../declarations/token_b";
import { Actor, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

export const AuthContext = createContext<ReturnType<typeof useAuthClient>>({
  isAuthenticated: false,
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  identity: undefined,
  principal: undefined,
});

export const useAuthClient = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState<Principal | undefined>(undefined);
  const [identity, setIdentity] = useState<Identity | undefined>(undefined);

  const authClientPromise = AuthClient.create();

  const login = async () => {
    const authClient = await authClientPromise;

    const internetIdentityUrl =
      process.env.DFX_NETWORK === "ic"
        ? "https://identity.ic0.app/#authorize"
        : `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`;

    await new Promise((resolve) => {
      authClient.login({
        identityProvider: internetIdentityUrl,
        windowOpenerFeatures: "toolbar=0,location=0,menubar=0,width=500,height=500,left=100,top=100",
        onSuccess: () => resolve(undefined),
      });
    });

    const identity = authClient.getIdentity();
    updateIdentity(identity);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    const authClient = await authClientPromise;
    await authClient.logout();
    const identity = authClient.getIdentity();
    updateIdentity(identity);
    setIsAuthenticated(false);
  };

  const updateIdentity = (identity: Identity) => {
    setIdentity(identity);
    setPrincipal(identity.getPrincipal());
    Actor.agentOf(DecentralizedExchange_backend)?.replaceIdentity!(identity);
    Actor.agentOf(token_a)?.replaceIdentity!(identity);
    Actor.agentOf(token_b)?.replaceIdentity!(identity);
  };

  const setInitialIdentity = async () => {
    try {
      const authClient = await AuthClient.create();
      const identity = authClient.getIdentity();
      updateIdentity(identity);
      setIsAuthenticated(await authClient.isAuthenticated());
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setInitialIdentity();
  }, []);

  return {
    isAuthenticated,
    login,
    logout,
    identity,
    principal,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthClient();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

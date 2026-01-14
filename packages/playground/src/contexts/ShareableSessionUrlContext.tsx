import { createContext, useContext } from "react";

export interface ShareableSessionUrlApi {
  /**
   * Replace URL back to "/play" and reset share-url baseline so it stays there
   * until the next persisted session change.
   */
  resetUrlToPlay: () => void;

  /**
   * Exit the playground and return to homepage/demo.
   * Uses replace semantics.
   */
  exitToHomepage: () => void;
}

const ShareableSessionUrlContext = createContext<ShareableSessionUrlApi | null>(
  null
);

export function ShareableSessionUrlProvider({
  value,
  children,
}: {
  value: ShareableSessionUrlApi;
  children: React.ReactNode;
}) {
  return (
    <ShareableSessionUrlContext.Provider value={value}>
      {children}
    </ShareableSessionUrlContext.Provider>
  );
}

export function useShareableSessionUrl(): ShareableSessionUrlApi {
  const ctx = useContext(ShareableSessionUrlContext);
  if (!ctx) {
    throw new Error(
      "useShareableSessionUrl must be used within ShareableSessionUrlProvider"
    );
  }
  return ctx;
}


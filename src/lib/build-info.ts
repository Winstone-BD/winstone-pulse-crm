declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;
declare const __BUILD_DEPLOYMENT_ID__: string;

/** Build stamp injected at build time (vite define). Values are never invented. */
export const BUILD_INFO = {
  commit: typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "unknown",
  builtAt: typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : null,
  deploymentId:
    typeof __BUILD_DEPLOYMENT_ID__ === "string" && __BUILD_DEPLOYMENT_ID__ ? __BUILD_DEPLOYMENT_ID__ : null,
};

export const SHORT_COMMIT = BUILD_INFO.commit === "unknown" ? "unknown" : BUILD_INFO.commit.slice(0, 8);

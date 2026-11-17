import "server-only";
import type { AssetProvider } from "./collector.ts";

// The registry of real asset providers. Empty on purpose: until one is added and verified, the collector claims nothing
// and reports "not configured". Add a provider by implementing AssetProvider (see collector.ts) and listing it here.
export const providers: AssetProvider[] = [];

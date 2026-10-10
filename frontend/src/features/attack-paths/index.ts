/**
 * Attack Paths Feature
 *
 * Visualizes potential attack chains through the threat model.
 */
export { AttackPathPanel } from "./components/AttackPathPanel";
export { AttackPathCanvas } from "./components/AttackPathCanvas";
export { AttackChainOverlay } from "./components/AttackChainOverlay";
export { useAttackPaths } from "./hooks/useAttackPaths";
export {
  useAttackChains,
  useUpdateAttackChainStatus,
  ATTACK_CHAIN_QUERY_KEYS,
} from "./hooks/useAttackChains";
export type { ChainStatus, AttackChainHop, AttackChainWithHops } from "./types";

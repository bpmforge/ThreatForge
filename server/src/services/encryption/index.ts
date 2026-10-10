/**
 * BYOK Encryption Module
 *
 * Exports encryption utilities and key management functions.
 */

export { encryptValue, decryptValue } from "./encryption-service.js";

export {
  getBYOKConfig,
  registerBYOKKey,
  registerBYOKFromPassphrase,
  verifyBYOKKey,
  getKeyConfig,
  rotateKey,
  generateAndRegisterKey,
  disableBYOK,
  listKeys,
  revokeKey,
} from "./key-manager.js";

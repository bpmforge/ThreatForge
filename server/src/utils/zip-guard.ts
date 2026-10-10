/**
 * Pre-extraction check for zip containers (DOCX): reads only the central
 * directory and refuses archives that would inflate into a decompression bomb.
 */

const MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN_LENGTH = 22;

/** Returns an error message when the archive is unsafe or malformed, else null. */
export function checkZipLimits(
  buffer: Buffer,
  limits = {
    maxBytes: MAX_ZIP_UNCOMPRESSED_BYTES,
    maxEntries: MAX_ZIP_ENTRIES,
  },
): string | null {
  // The end-of-central-directory record sits in the last 64 KiB + 22 bytes.
  let eocd = -1;
  const lowest = Math.max(0, buffer.length - (0xffff + EOCD_MIN_LENGTH));
  for (let i = buffer.length - EOCD_MIN_LENGTH; i >= lowest; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return "Not a valid zip archive";

  const entries = buffer.readUInt16LE(eocd + 10);
  const dirSize = buffer.readUInt32LE(eocd + 12);
  const dirOffset = buffer.readUInt32LE(eocd + 16);
  // 0xFFFF / 0xFFFFFFFF mean zip64, which no real Word file needs.
  if (entries === 0xffff || dirOffset === 0xffffffff) {
    return "Zip64 archives are not supported";
  }
  if (entries > limits.maxEntries) return "Archive has too many entries";
  if (dirOffset + dirSize > buffer.length) return "Not a valid zip archive";

  let pos = dirOffset;
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (
      pos + 46 > buffer.length ||
      buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE
    ) {
      return "Not a valid zip archive";
    }
    const size = buffer.readUInt32LE(pos + 24);
    if (size === 0xffffffff) return "Zip64 archives are not supported";
    total += size;
    if (total > limits.maxBytes) return "Archive expands to too much data";
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

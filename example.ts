import { p256 } from "@noble/curves/nist.js";
import { formatMultikey, multibaseToBytes } from "@atproto/crypto";
import { signRecord, stripMulticodecHeader, verifyRecord } from "./index.ts";

const officialRecord = {
  did: "did:plc:1234",
  score: "85%",
};

const fakeRecord = {
  did: "did:plc:1234",
  score: "100%",
};

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error("PRIVATE_KEY environment variable is not set");

const publicKey = process.env.PUBLIC_KEY ?? (() => {
  const pubBytes = p256.getPublicKey(
    stripMulticodecHeader(multibaseToBytes(privateKey))
  );
  return formatMultikey("ES256", pubBytes);
})();

// sign official record
const signature = signRecord(officialRecord, privateKey);

// validate official record
const officialRecordValidationResult = verifyRecord(officialRecord, signature, publicKey);
console.log("official record is", officialRecordValidationResult ? "valid" : "not valid");

// validate fake record
const fakeRecordValidationResult = verifyRecord(fakeRecord, signature, publicKey);
console.log("fake record is", fakeRecordValidationResult ? "valid" : "not valid");

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPE = /^image\/|^application\/pdf$/;

export interface ReceiptUploadResult {
  receiptUrl: string;
  receiptName: string;
  receiptPath: string;
}

// Mirrors storage.rules: receipts/** must be < 10MB and image/* or PDF.
// Validating client-side too gives an immediate, readable error instead of
// a generic "permission denied" from a rejected write.
export function validateReceiptFile(file: File): string | null {
  if (file.size >= MAX_RECEIPT_BYTES) return "Receipts must be under 10MB.";
  if (!ALLOWED_RECEIPT_TYPE.test(file.type)) return "Receipts must be an image or a PDF.";
  return null;
}

// expenseId should be reserved with newId("expenses") before the expense
// itself is saved, so the receipt path and the expense document agree even
// if the form is creating both at once.
export async function uploadReceipt(expenseId: string, file: File): Promise<ReceiptUploadResult> {
  const error = validateReceiptFile(file);
  if (error) throw new Error(error);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const receiptPath = `receipts/${expenseId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, receiptPath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const receiptUrl = await getDownloadURL(storageRef);
  return { receiptUrl, receiptName: file.name, receiptPath };
}

export async function removeReceiptByUrl(url: string): Promise<void> {
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // Best-effort: an already-missing or unparsable object shouldn't block
    // the caller from clearing the reference on the expense document.
  }
}

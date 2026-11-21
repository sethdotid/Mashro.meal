import { initializeApp } from 'firebase/app';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { FirestoreRestConfig, restProbeConnection } from './utils/firestoreRestClient';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const FIRESTORE_REST_CONFIG: FirestoreRestConfig = {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  apiKey: firebaseConfig.apiKey,
};

let sdkTransportDegraded = false;

export function markSdkTransportDegraded(): void {
  sdkTransportDegraded = true;
}

export function isSdkTransportDegraded(): boolean {
  return sdkTransportDegraded;
}

/**
 * Startup Firestore connectivity check as required by firebase-integration-rpc.
 * Distinguishes blocked WebChannel streaming (where stateless HTTPS REST works)
 * from an actually offline client or invalid Firebase configuration.
 */
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      const restReachable = await restProbeConnection(FIRESTORE_REST_CONFIG, 2500);
      if (restReachable) {
        sdkTransportDegraded = true;
      } else {
        console.error('Konfigurasi Firebase gagal terhubung: klien sedang offline.');
      }
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

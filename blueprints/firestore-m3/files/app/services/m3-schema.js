import DefaultSchema from 'ember-m3/services/m3-schema';
import { FirestoreM3Schema } from 'firestore-m3';

export default DefaultSchema.extend(FirestoreM3Schema);

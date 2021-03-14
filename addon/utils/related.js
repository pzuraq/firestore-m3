import Firebase from 'firebase/app';
import 'firebase/firestore';

const DOC_ID = Firebase.firestore.FieldPath.documentId();

const RELATED = new Map();

export function setRelated(id, related) {
  RELATED.set(id, related);
}

export function getRelated(model) {
  let related = RELATED.get(model.id);

  let promises = [];

  for (let key in related) {
    let promise = model.store.query(key, {
      where: [DOC_ID, 'in', related[key]],
    });
    promises.push(promise);
  }

  return Promise.all(promises);
}

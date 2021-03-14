import { inject as service } from '@ember/service';
import { getOwner, setOwner } from '@ember/application';
import { Promise } from 'rsvp';

export default class FirestoreM3Adapter {
  @service() firebase;
  @service() store;

  constructor(createArgs) {
    setOwner(this, getOwner(createArgs));

    // Cache the db locally to avoid extra property lookups. If this ever
    // causes issues, just remove it and lookup the db directly.
    this.db = window.db = this.firebase.db;
  }

  static create(createArgs) {
    return new this(createArgs);
  }

  shouldReloadRecord() {
    return false;
  }
  shouldBackgroundReloadRecord() {
    return false;
  }

  findAll(store, modelClass, ignoreMe, snapshot) {
    let { modelName } = snapshot;

    return getCollection(
      this.db.collection(modelName),
      modelName,
      this.db,
      this.store,
      false
    );
  }

  query(store, type, query, snapshot) {
    let { modelName } = snapshot;
    let { where, orderBy, limit, subscribe } = query;

    let ref = this.db.collection(modelName);

    if (where) {
      if (Array.isArray(where[0])) {
        where.forEach((query) => (ref = ref.where(...query)));
      } else {
        ref = ref.where(...where);
      }
    }

    if (orderBy) {
      ref = ref.orderBy(orderBy);
    }

    if (limit) {
      ref = ref.limit(limit);
    }

    return getCollection(ref, modelName, this.db, this.store, subscribe);
  }

  queryRecord(store, modelClass, query, snapshot) {
    query.limit = 1;

    return this.query(store, modelClass, query, snapshot).then((response) => {
      return {
        data: response.data[0],
      };
    });
  }

  findRecord(store, modelClass, id, snapshot) {
    return _getAndSubscribe(
      this.db.collection(snapshot.modelName).doc(id),
      this.store
    );
  }

  updateRecord(store, modelClass, snapshot) {
    let { modelName, id } = snapshot;
    let serialized = store.serializerFor('application').serialize(snapshot);

    return this.db.collection(modelName).doc(id).set(serialized);
  }

  createRecord(store, modelClass, snapshot) {
    let { modelName } = snapshot;
    let serialized = store.serializerFor('application').serialize(snapshot);

    return this.db
      .collection(modelName)
      .add(serialized)
      .then((ref) => {
        return _getAndSubscribe(ref, this.store);
      });
  }

  deleteRecord(store, modelClass, snapshot) {
    let { modelName, id } = snapshot;

    return this.db
      .collection(modelName)
      .doc(id)
      .delete()
      .then(() => {
        return { data: null };
      });
  }
}

function getCollection(ref, type, db, store, subscribe) {
  return ref.get().then((snapshot) => {
    let data = snapshot.docs.map((docRef) => {
      if (subscribe === true) {
        _getAndSubscribe(db.collection(type).doc(docRef.id), store);
      }

      return {
        id: docRef.id,
        type: docRef.ref.parent.id,
        attributes: docRef.data(),
      };
    });

    return { data };
  });
}

function _getAndSubscribe(ref, store) {
  let isFirst = true;
  let unsubscribe;

  return new Promise((resolve, reject) => {
    unsubscribe = ref.onSnapshot(
      function (snapshot) {
        let data = {
          id: snapshot.id,
          type: snapshot.ref.parent.id,
          attributes: snapshot.data(),
        };

        let doc = { data, included: [] };

        if (isFirst === true) {
          isFirst = false;

          if (!doc || !doc.data) {
            reject({
              code: 404,
              message: 'Not Found',
            });
          } else {
            resolve(doc);
          }
        } else {
          let local = store.peekRecord(doc.data.type, doc.data.id);

          if (local && (local.isDirty || local.isSaving)) {
            // If it's dirty, then we either have just saved and are waiting
            // for those changes to be synced to the server, OR we have changes
            // coming from the server and we need to renconcile them. In the
            // future, this is where reconciliation APIs would hook in.
            return;
          }

          if (doc && doc.data) {
            store.push(doc);
          } else {
            // maybe we deleted the model? Should figure out what happens here
            unsubscribe();
          }
        }
      },
      function (error) {
        throw error;
      }
    );
  });
}

import { inject as service } from '@ember/service';
import { setRelated } from '../utils/related';
import { isModelReference } from '../utils/reference';

export default class FirestoreM3Serializer {
  @service() store;

  constructor(createArgs) {
    Object.assign(this, createArgs);
  }

  normalizeResponse(store, modelClass, payload) {
    let { data } = payload;

    if (Array.isArray(data)) {
      data.forEach((model) => {
        setRelated(model.id, model.attributes.__related);
        delete model.attributes.__related;
      });
    } else {
      setRelated(data.id, data.attributes.__related);
      delete data.attributes.__related;
    }

    return payload;
  }

  serialize(snapshot, related) {
    if (related === undefined) {
      return serializeTopLevelModel(snapshot);
    } else {
      return serializeEmbeddedModel(snapshot, related);
    }
  }

  static create(createArgs) {
    return new this(createArgs);
  }
}

function serializeTopLevelModel(snapshot) {
  let related = Object.create(null);
  let delta = snapshot.attributes();

  for (let key in delta) {
    delta[key] = serializeValue(snapshot, key, delta[key], related);
  }

  delta.__related = related;

  return delta;
}

function serializeEmbeddedModel(snapshot, related) {
  if (snapshot.attributes) {
    let { id, modelName: type } = snapshot;

    let value = { id, type };

    pushRelated(related, value);

    return value;
  } else {
    let delta = snapshot.attrs;

    for (let key in delta) {
      delta[key] = serializeValue(snapshot, key, delta[key], related);
    }

    return delta;
  }
}

function serializeValue(snapshot, key, value, related) {
  if (value === null) {
    let recordData = recordDataFor(snapshot);
    let originalValue = recordData.getAttr(key);

    if (
      recordData.isAttrDirty(key) === false &&
      isModelReference(originalValue)
    ) {
      pushRelated(related, originalValue);
      return originalValue;
    }
  } else if (typeof value === 'object') {
    if (typeof value.toArray === 'function') {
      let arr = value.toArray();

      return arr.map((v) => serializeValue(snapshot, key, v, related));
    }

    if (typeof value.serialize === 'function') {
      return value.serialize(related);
    }
  }

  return value;
}

function pushRelated(related, value) {
  let { id, type } = value;
  let relatedType = related[type];

  if (relatedType === undefined) {
    relatedType = related[type] = [];
  }

  relatedType.push(id);
}

function recordDataFor(snapshot) {
  return (
    snapshot.record._recordData ?? snapshot.record._internalModel._recordData
  );
}

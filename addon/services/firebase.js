import Firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/storage';
import Service from '@ember/service';

export default class FirebaseService extends Service {
  constructor(owner) {
    super(owner);

    const config = owner.resolveRegistration('config:environment');

    if (!config || typeof config.firebase !== 'object') {
      throw new Error(
        'Please set the `firebase` property in your environment config.'
      );
    }

    this.config = config.firebase;
    this.app = null;
    this.db = null;
    this.auth = null;
    this.storage = null;
    this.connect();
  }

  connect() {
    if (this.app !== null) {
      return;
    }
    let app;

    try {
      app = Firebase.app();
    } catch (e) {
      app = Firebase.initializeApp(this.config);
    }

    this.app = app;
    let db = (this.db = app.firestore());
    this.auth = app.auth();
    this.storage = app.storage();

    this.readyPromise = db
      .enablePersistence({ synchronizeTabs: true })
      .catch(function (err) {
        console.log('Firestore failed to enable offline support');
        console.error(err);
      });
  }
}

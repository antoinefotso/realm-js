'use strict';

const Realm = require('../../..');
const fs = require('fs');
const http = require('http');
const path = require('path');
const tmp = require('tmp');

function waitForUpload(realm) {
    return realm.syncSession.uploadAllLocalChanges().then(() => new Promise(r => {
        // FIXME: uploadAllLocalChanges() is currently broken and sometimes resolves early
        // https://github.com/realm/realm-sync/issues/2580
        setTimeout(() => r(realm), 1);
    }));
}

global.RosController = module.exports = class RosController {
    constructor() {
        this.httpPort = 9080;
        this.adminToken = JSON.parse(fs.readFileSync('../realm-object-server-data/keys/admin.json', 'utf8'))['ADMIN_TOKEN'];
        this.adminUser = Realm.Sync.User.login(`http://127.0.0.1:${this.httpPort}`,
                                               Realm.Sync.Credentials.adminToken(this.adminToken));
        this._temp = tmp.dirSync({ unsafeCleanup: true});
    }

    start() {
        return Realm.open({
            path: path.join(this._temp.name, 'admin.realm'),
            sync: {
                user: this.adminUser,
                url: `realm://127.0.0.1:${this.httpPort}/__admin`
            }
        }).then(realm => {
            this.adminRealm = realm;
        });
    }

    shutdown() {
        return waitForUpload(this.adminRealm).then(realm => {
            realm.close();
            this._temp.removeCallback();
        });
    }

    createRealm(serverPath, schema, localPath) {
        return Realm.open({
            path: localPath,
            schema: schema,
            sync: {
                user: this.adminUser,
                url: `realm://127.0.0.1:${this.httpPort}/${this.pathPrefix}/${serverPath}`
            }
        }).then(r => waitForUpload(r));
    }

    deleteRealm(serverPath) {
        const request = http.request({
            host: 'localhost',
            port: this.httpPort,
            path: `/api/realm/${this.pathPrefix}/${serverPath}`,
            method: 'DELETE',
            headers: {
                'Authorization': `Realm-Access-Token version=1 token="${this.adminToken}"`
            }
        });
        return new Promise((r, e) => {
            request.on('response', r);
            request.on('error', e);
            request.end();
        });
    }

    setRealmPathPrefix(prefix) {
        this.pathPrefix = prefix;
    }
};

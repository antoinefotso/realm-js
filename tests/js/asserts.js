////////////////////////////////////////////////////////////////////////////
//
// Copyright 2016 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

'use strict';

function expectWithContext(val, errorMessage) {
    let e = expect(val);
    if (errorMessage) {
        e = e.withContext(errorMessage);
    }
    return e;
}

module.exports = {
    assertSimilar: function(type, val1, val2, errorMessage, depth) {
        depth = depth || 0;
        this.assertDefined(type, depth + 1);
        type = type.replace('?', '');
        if (val2 === null) {
            this.assertNull(val1, errorMessage, depth + 1);
        }
        else if (type === 'float' || type === 'double') {
            this.assertEqualWithTolerance(val1, val2, 0.000001, errorMessage, depth + 1);
        }
        else if (type === 'data') {
            this.assertArraysEqual(new Uint8Array(val1), val2, errorMessage, depth + 1);
        }
        else if (type === 'date') {
            this.assertEqual(val1 && val1.getTime(), val2.getTime(), errorMessage, depth + 1);
        }
        else if (type === 'object') {
            for (const key of Object.keys(val1)) {
                const message = errorMessage ? `${errorMessage}: ${key}` : key;
                this.assertEqual(val1[key], val2[key], message, depth + 1);
            }
        }
        else if (type === 'list') {
            this.assertArraysEqual(val1, val2, errorMessage, depth + 1);
        }
        else {
            this.assertEqual(val1, val2, errorMessage, depth + 1);
        }
    },

    assertEqual: function(val1, val2, errorMessage) {
        expectWithContext(val1, errorMessage).toEqual(val2);
    },

    assertNotEqual: function(val1, val2, errorMessage) {
        expectWithContext(val1, errorMessage).not.toEqual(val2);
    },

    assertEqualWithTolerance: function(val1, val2, tolerance, errorMessage) {
        expectWithContext(val1, errorMessage).toBeCloseTo(val2, tolerance);
    },

    assertArray: function(value, length, errorMessage, depth) {
        if (!Array.isArray(value)) {
            throw new TestFailureError(errorMessage || `Value ${value} is not an array`, depth);
        }
    },

    assertArrayLength: function(value, length, errorMessage, depth) {
        this.assertArray(value, 1 + depth || 0);
        if (value.length !== length) {
            throw new TestFailureError(errorMessage || `Value ${value} is not an array of length ${length}`, depth);
        }
    },

    assertArraysEqual: function(val1, val2, errorMessage, depth) {
        this.assertDefined(val1, `val1 should be non-null but is ${val1}`, 1 + (depth || 0));
        this.assertDefined(val2, `val2 should be non-null but is ${val2}`, 1 + (depth || 0));
        const len1 = val1.length;
        const len2 = val2.length;

        if (len1 !== len2) {
            let message = `Arrays (${val1}) and (${val2}) have different lengths (${len1} != ${len2})`;
            if (errorMessage) {
                message = `${errorMessage} - ${message}`;
            }
            throw new TestFailureError(message);
        }

        let compare;
        if (val1.type === "data") {
            compare = (i, a, b) => a === b || this.assertArraysEqual(new Uint8Array(a), b, `Data elements at index ${i}`, 1) || true;
        }
        else if (val1.type === "date") {
            compare = (i, a, b) => (a && a.getTime()) === (b && b.getTime());
        }
        else if (val1.type === "float" || val1.type === "double") {
            compare = (i, a, b) => a >= b - 0.000001 && a <= b + 0.000001;
        }
        else if (val1.type === 'object') {
            compare = (i, a, b) => Object.keys(a).every(key => a[key] === b[key]);
        }
        else {
            compare = (i, a, b) => a === b;
        }

        for (let i = 0; i < len1; i++) {
            if (!compare(i, val1[i], val2[i])) {
                let message = `Array contents not equal at index ${i} (${val1[i]} != ${val2[i]})`;
                if (errorMessage) {
                    message = `${errorMessage} - ${message}`;
                }
                throw new TestFailureError(message);
            }
        }
    },

    assertThrows: function(func, errorMessage) {
        expectWithContext(func).toThrow();
    },

    assertThrowsException: function(func, expectedException) {
        expectWithContext(func).toThrow(expectedException);
    },

    assertThrowsContaining: function(func, expectedMessage) {
        expectWithContext(func).toThrowError(Error, expectedMessage);
    },

    assertTrue: function(condition, errorMessage) {
        expectWithContext(condition, errorMessage).toBeTruthy();
    },

    assertFalse: function(condition, errorMessage) {
        expectWithContext(condition, errorMessage).toBeFalsy();
    },

    assertInstanceOf: function(object, type, errorMessage, depth) {
        if (!(object instanceof type)) {
            throw new TestFailureError(errorMessage || `Object ${object} expected to be of type ${type}`, depth);
        }
    },

    assertType: function(value, type, depth) {
        try {
            this.assertEqual(typeof value, type, "", 1 + depth || 0);
        }
        catch (e) {
            throw new Error(`Value ${value} expected to be of type ${type}`)
        }
    },

    assertDefined: function(value, errorMessage) {
        expectWithContext(value, errorMessage).toBeDefined();
    },

    assertUndefined: function(value, errorMessage) {
        expectWithContext(value, errorMessage).toBeUndefined();
    },

    assertNull: function(value, errorMessage) {
        expectWithContext(value, errorMessage).toBe(null);
    },

    isNode: function() {
        // eslint-disable-next-line no-undef
        return typeof process == 'object' && Object.prototype.toString.call(process) == '[object process]';
    },

    isNode6: function() {
        // eslint-disable-next-line no-undef
        return this.isNode() && process.version.indexOf('v6.') == 0;
    },
};

function TestFailureError(message, depth) {
    fail(message);

    let error;
    try {
        throw new Error(message);
    } catch (e) {
        error = e;
    }

    depth = 2 + (depth || 0);

    // This regular expression will match stack trace lines provided by JavaScriptCore.
    // Example: someMethod@file:///path/to/file.js:10:24
    const regex = /^(?:.*?@)?([^[(].+?):(\d+)(?::(\d+))?\s*$/;

    // Remove the top two stack frames and use information from the third, if possible.
    const stack = error.stack && error.stack.split('\n');
    const match = stack[depth] && stack[depth].match(regex);
    if (match) {
        this.sourceURL = match[1];
        this.line = +match[2];
        this.column = +match[3];
        this.stack = stack.slice(depth).join('\n');
    }

    this.__proto__ = error;
}

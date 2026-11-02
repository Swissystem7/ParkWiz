'use strict';

// Client errors from the occupancy assignment prototype. status is the HTTP
// code the handler should return; code is the stable machine string.
class AssignError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AssignError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { AssignError };

var http = require('http'),
    https = require('https'),
    url = require('url'),
    Q = require('q');

function SimpleClient(_endpoint) {
  this.endpoint = url.parse(_endpoint);
}

function performJsonRequest(_client, _options, _data, _success, _error) {
  _options.host = _client.endpoint.host;
  _options.path = _client.endpoint.path;
  if(!_options.headers) _options.headers = {};
  if(_data) {
    _options.headers['Content-Type'] = 'application/json';
  }

  // console.log(_options);

  var type = _client.endpoint.protocol == 'https:' ? https : http,
      request = type.request(_options);

  request.on('response', function(resp) {
    var data = '';
    resp.setEncoding('utf8');
    resp.on('data', function (chunk) {
      data += chunk;
    });
    resp.on('end', function() {
      try {
        data = JSON.parse(data);
      } catch(exc) {
        if(_error) _error(exc);
      }

      if(_success) _success(resp.statusCode, data);
    });
  });

  request.on('error', function(e) {
    if(_error) _error(e);
  });

  if(_data) request.write(JSON.stringify(_data));
  request.end();
}

SimpleClient.prototype = {
  get: function(_success, _error) {
    performJsonRequest(this, {
      method: 'GET'
    }, null, _success, _error);
  },

  post: function(_data, _success, _error) {
    performJsonRequest(this, {
      method: 'POST'
    }, _data, _success, _error);
  },

  put: function(_data, _success, _error) {
    performJsonRequest(this, {
      method: 'PUT'
    }, _data, _success, _error);
  },

  delete: function(_success, _error) {
    performJsonRequest(this, {
      method: 'DELETE'
    }, null, _success, _error);
  }
};

function GridAdaptor(_name) {
  this.host = 'https://grid.crabfarm.io';
  this.name = _name;
}

GridAdaptor.prototype = {
  startSession: function(_success, _error) {
    var self = this;
    client = new SimpleClient(this.host + '/api/bots/' + this.name + '/sessions');
    client.post({}, function(_code, _data) {
      if(_code == 201) {
        _success(new SimpleClient(self.host + '/api/sessions/' + _data.id));
      } else {
        _error(_code);
      }
    }, _error);
  }
};

function CamaronSession(_adaptor) {
  this.adaptor = _adaptor;
  this.promise = Q();
}

function wrapPromise(_session, _fun) {
  if(!_fun) return null;

  return function() {
    var oldPromise = _session.promise;
    _session.promise = Q();
    try {
      _fun(_session);
      return _session.promise;
    } finally {
      _session.promise = oldPromise;
    }
  };
}

function putTillResponse(_resource, _params, _success, _error) {
  _resource.put(_params, function(_code, _body) {
    if(_code == 408) {
      putTillResponse(_resource, _params, _success, _error);
    } else {
      _success(_code, _body);
    }
  }, _error);
}

function setResult(_session, _data) {
  _session.data = _data;
  _session.error = null;
  _session.errorData = null;
}

function setError(_session, _error, _data) {
  _session.data = null;
  _session.error = _error;
  _session.errorData = _data;
}

CamaronSession.prototype = {

  connect: function() {
    var self = this;
    this.promise = this.promise.then(function() {
      var dfd = Q.defer();
      self.adaptor.startSession(function(_session) {
        self._resource = _session;
        setResult(self, null);
        dfd.resolve();
      }, function(_error) {
        setError(self, _error);
        dfd.reject();
      });

      return dfd.promise;
    });
    return this;
  },

  navigate: function(_name, _params) {
    var self = this;
    if(!_params) _params = {};
    this.promise = this.promise.then(function() {
      var dfd = Q.defer();

      putTillResponse(self._resource, {
        name: _name,
        params: _params,
        wait: 30.0
      }, function(_code, _body) {
        self.name = _body.name;
        if(_code == 200) {
          setResult(self, _body.doc);
          dfd.resolve();
        } else {
          setError(self, _code, _body);
          dfd.reject();
        }
      }, function(_error) {
        setError(self, _error);
        dfd.reject();
      });

      return dfd.promise;
    });

    return this;
  },

  close: function() {
    var self = this;
    this.promise = this.promise.then(function() {
      self._resource['delete']();
      self._resource = null;
    });

    return this;
  },

  then: function(_cb, _error_cb) {
    var session = this;
    this.promise = this.promise.then(wrapPromise(this, _cb), wrapPromise(this, _error_cb));
    return this;
  },

  rescue: function(_cb) {
    return this.then(null, _cb);
  },

  ensure: function(_cb) {
    return this.then(_cb, _cb);
  }
};

CamaronSession.prototype.nav = CamaronSession.prototype.navigate;
CamaronSession.prototype['catch'] = CamaronSession.prototype.rescue;
CamaronSession.prototype['finally'] = CamaronSession.prototype.ensure;

module.exports = {
  connect: function(_name) {
    // TODO: more adaptor options
    var adaptor = new GridAdaptor(_name),
        session = new CamaronSession(adaptor);

    return session.connect();
  }
};
